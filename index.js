const path = require('path');
const imgSize = require('image-size');
const fs = require('fs');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

// get-video-dimensions package is async only which
// makes it harder to use with babel. This is a "sync"
// copy of the original as of 04-08-2019.
function videoSize(path) {
    const result = execFileSync('ffprobe', [
        '-v',
        'error',
        '-of',
        'flat=s=_',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=height,width',
        path
    ]).toString();
    const width = parseInt(/width=(\d+)/.exec(result)[1] || 0);
    const height = parseInt(/height=(\d+)/.exec(result)[1] || 0);
    const type = path
        .split('.')
        .pop()
        .toLowerCase();

    return {width, height, type};
}

function createMediaObject(importedPath, {file, normalizedOpts: opts}) {
    const {root, filename} = file.opts;
    const mediaPath = importedPath.startsWith('/')
        ? importedPath
        : path.resolve(path.join(filename ? path.dirname(filename) : root, importedPath));
    const isVideo = mediaPath.match(opts.videoExtensionRegex);
    const isSVG = mediaPath.toLowerCase().endsWith('.svg');
    const {width, height, type} = (isVideo ? videoSize : imgSize)(mediaPath);

    let pathname = mediaPath.replace(opts.baseDir, '');
    let _fileBuffer;
    const fileContents = () => (_fileBuffer = _fileBuffer || fs.readFileSync(mediaPath));
    let content = undefined;
    let base64 = null;
    let hash = null;

    if (isSVG) content = fileContents().toString();
    if (opts.pathnamePrefix) pathname = path.join(opts.pathnamePrefix, pathname);
    if (opts.hash) {
        const splatOpts = opts.hash.constructor === Object ? opts.hash : {};
        const {delimiter, length, algo} = {
            delimiter: '-',
            length: null,
            algo: 'md5',
            ...splatOpts
        };
        const [fname, ...rest] = path.basename(pathname).split('.');
        hash = crypto
            .createHash(algo)
            .update(fileContents())
            .digest('hex');

        if (length) hash = hash.slice(0, Math.max(4, length));

        pathname = path.join(
            path.dirname(pathname),
            `${fname}${delimiter}${hash}.${rest.join('.')}`
        );
    }

    if (opts.base64) {
        const splatOpts = opts.base64.constructor === Object ? opts.base64 : {};
        const fileSize = fs.statSync(mediaPath).size;
        const {maxSize} = {maxSize: 8192, ...splatOpts};

        if (maxSize > fileSize) {
            const b64str = fileContents().toString('base64');
            base64 = `data:${isVideo ? 'video' : 'image'}/${type};base64,${b64str}`;
        }
    }

    if (opts.outputRoot) {
        const outputPath = path.join(opts.outputRoot, pathname);
        fs.mkdirSync(path.dirname(outputPath), {recursive: true});
        fs.writeFileSync(outputPath, fileContents());
    }

    return {
        pathname,
        src: base64 || pathname,
        width: width,
        height: height,
        aspectRatio: parseFloat((width / height).toFixed(3)),
        heightToWidthRatio: parseFloat((height / width).toFixed(3)),
        content,
        type: type,
        hash
    };
}

function toBabelMediaObject(m, t) {
    return {
        pathname: t.stringLiteral(m.pathname),
        src: t.stringLiteral(m.src),
        hash: m.hash && t.stringLiteral(m.hash),
        type: t.stringLiteral(m.type),
        width: t.numericLiteral(m.width),
        height: t.numericLiteral(m.height),
        aspectRatio: t.numericLiteral(m.aspectRatio),
        content: m.content && t.stringLiteral(m.content),
        heightToWidthRatio: t.numericLiteral(m.heightToWidthRatio)
    };
}

module.exports = ({types: t}) => ({
    name: 'transform-media-imports',

    pre() {
        const {
            baseDir = process.cwd(),
            pathnamePrefix = '',
            outputRoot = null,
            imageExtensions = ['jpeg', ...imgSize.types],
            videoExtensions = ['mp4', 'webm', 'ogv'],
            md5 = false, // kept for backwards compatibility, it is only ever assigned to hash below
            hash = md5,
            base64 = false
        } = this.opts;

        this.normalizedOpts = {
            baseDir: path.resolve(baseDir),
            outputRoot: outputRoot && path.resolve(outputRoot),
            pathnamePrefix,
            imageExtensions,
            videoExtensions,
            hash,
            base64,
            imageExtensionRegex: new RegExp(`\.(?:${imageExtensions.join('|')})$`, 'i'),
            videoExtensionRegex: new RegExp(`\.(?:${videoExtensions.join('|')})$`, 'i'),
            extensionRegex: new RegExp(
                '\\.(?:' + [...imageExtensions, ...videoExtensions].join('|') + ')$',
                'i'
            )
        };
    },

    visitor: {
        ExportNamedDeclaration(p) {
            const transforms = [];
            if (!p.node.source) return;
            const {
                specifiers,
                source: {value: rawExportPath}
            } = p.node;

            if (rawExportPath.match(this.normalizedOpts.extensionRegex)) {
                const exps = specifiers.filter(t.isExportSpecifier);
                const defaultExport =
                    specifiers.find(t.isExportDefaultSpecifier) ||
                    exps.find(({local}) => local.name === 'default');
                const namedExports = exps.filter(({local}) => local.name !== 'default');
                const media = toBabelMediaObject(
                    createMediaObject(rawExportPath, this),
                    t
                );

                if (defaultExport) {
                    transforms.push(
                        t.exportDefaultDeclaration(
                            t.objectExpression(
                                Object.entries(media)
                                    .filter(([_, v]) => v)
                                    .map(([k, v]) => t.objectProperty(t.identifier(k), v))
                            )
                        )
                    );
                }

                if (namedExports.length) {
                    transforms.push(
                        ...namedExports.map(namedExport =>
                            t.exportNamedDeclaration(
                                t.variableDeclaration('const', [
                                    t.variableDeclarator(
                                        t.identifier(namedExport.exported.name),
                                        media[namedExport.local.name]
                                    )
                                ]),
                                []
                            )
                        )
                    );
                }
            }

            if (transforms.length) {
                p.replaceWithMultiple(transforms);
                p.stop();
            }
        },

        ImportDeclaration(p) {
            const transforms = [];
            const {
                specifiers,
                source: {value: rawImportPath}
            } = p.node;

            if (rawImportPath.match(this.normalizedOpts.extensionRegex)) {
                const defaultImport = specifiers.find(t.isImportDefaultSpecifier);
                const namedImports = specifiers.filter(t.isImportSpecifier);
                const media = toBabelMediaObject(
                    createMediaObject(rawImportPath, this),
                    t
                );

                if (defaultImport) {
                    transforms.push(
                        t.variableDeclaration('const', [
                            t.variableDeclarator(
                                t.identifier(defaultImport.local.name),
                                t.objectExpression(
                                    Object.entries(media)
                                        .filter(([_, v]) => v)
                                        .map(([k, v]) =>
                                            t.objectProperty(t.identifier(k), v)
                                        )
                                )
                            )
                        ])
                    );
                }

                transforms.push(
                    ...namedImports
                        .filter(namedImport => media[namedImport.imported.name])
                        .map(namedImport =>
                            t.variableDeclaration('const', [
                                t.variableDeclarator(
                                    t.identifier(namedImport.local.name),
                                    media[namedImport.imported.name]
                                )
                            ])
                        )
                );
            }

            if (transforms.length) {
                p.replaceWithMultiple(transforms);
                p.skip();
            }
        }
    }
});
