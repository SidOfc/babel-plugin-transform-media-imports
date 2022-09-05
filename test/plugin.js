import assert from 'assert';
import * as babel from '@babel/core';
import {sync as executable} from 'hasbin';
import fs from 'fs';
import rimraf from 'rimraf';
import path from 'path';
import {execFileSync} from 'child_process';

function transform(code, options = {}, transformOptions = {}) {
    return babel.transform(code, {
        presets: [['@babel/preset-env', {modules: false}]],
        plugins: [
            ...(transformOptions.pluginsBefore ?? []),
            ['./index', options],
            ...(transformOptions.pluginsAfter ?? []),
        ],
    }).code;
}

describe('babel-plugin-transform-media-imports', function () {
    it('can get dimensions from a video file', function () {
        assert.equal(
            transform('import video from "test/files/media-file.webm"'),
            [
                'var video = {',
                '  pathname: "/test/files/media-file.webm",',
                '  src: "/test/files/media-file.webm",',
                '  type: "webm",',
                '  width: 768,',
                '  height: 180,',
                '  aspectRatio: 4.267,',
                '  heightToWidthRatio: 0.234',
                '};',
            ].join('\n')
        );
    });

    it('can default export a media file using named exports', function () {
        assert.equal(
            transform('export {default} from "test/files/media-file.jpg"'),
            [
                'export default {',
                '  pathname: "/test/files/media-file.jpg",',
                '  src: "/test/files/media-file.jpg",',
                '  type: "jpeg",',
                '  width: 280,',
                '  height: 280,',
                '  aspectRatio: 1,',
                '  heightToWidthRatio: 1',
                '};',
            ].join('\n')
        );
    });

    it('can export a specific property from a media file using named exports', function () {
        assert.equal(
            transform('export {width} from "test/files/media-file.jpg"'),
            'export const width = 280;'
        );
    });

    it('can export a specific property from a media file using named exports with "as"', function () {
        assert.equal(
            transform('export {width as w} from "test/files/media-file.jpg"'),
            'export const w = 280;'
        );
    });

    it('can export a property from the media file', function () {
        assert.equal(
            transform('export {width, height as h} from "test/files/media-file.jpg"'),
            'export const width = 280;\nexport const h = 280;'
        );
    });

    it('makes file content available for .svg files', function () {
        const svgContent = fs
            .readFileSync('test/files/media-file.svg')
            .toString()
            .replace(/"/g, (m, x, subject) => (subject[x - 1] === '\\' ? m : `\\${m}`))
            .replace(/\n/g, '\\n');

        assert.equal(
            transform('import {content} from "test/files/media-file.svg"'),
            `var content = "${svgContent}";`
        );
    });

    it('converts default import to object with information', function () {
        assert.equal(
            transform('import a from "test/files/media-file.jpg"'),
            [
                'var a = {',
                '  pathname: "/test/files/media-file.jpg",',
                '  src: "/test/files/media-file.jpg",',
                '  type: "jpeg",',
                '  width: 280,',
                '  height: 280,',
                '  aspectRatio: 1,',
                '  heightToWidthRatio: 1',
                '};',
            ].join('\n')
        );
    });

    it('converts named imports to variable declarations', function () {
        assert.equal(
            transform('import {pathname, width as aw} from "test/files/media-file.jpg"'),
            'var pathname = "/test/files/media-file.jpg";\nvar aw = 280;'
        );
    });

    describe('options', function () {
        describe('baseDir', function () {
            it('removes provided baseDir from output pathname', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        baseDir: 'test',
                    }),
                    'var pathname = "/files/media-file.jpg";'
                );
            });

            it('removes process.cwd() from output pathname by default', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"'),
                    'var pathname = "/test/files/media-file.jpg";'
                );
            });
        });

        describe('pathnamePrefix', function () {
            it('prepends pathnamePrefix if specified', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        pathnamePrefix: '/assets',
                    }),
                    'var pathname = "/assets/test/files/media-file.jpg";'
                );
            });

            it('prepends nothing by default', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"'),
                    'var pathname = "/test/files/media-file.jpg";'
                );
            });
        });

        describe('outputRoot', function () {
            it('writes imported media file to specified directory', function () {
                return rimraf('test/fake-root/test', () => {
                    transform('import {pathname} from "test/files/media-file.svg"', {
                        outputRoot: 'test/fake-root',
                    });

                    assert(fs.existsSync('test/fake-root/test/files/media-file.svg'));
                });
            });
        });

        describe('imageExtensions', function () {
            it('does not transform when extension is not included in imageExtensions', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        imageExtensions: [],
                    }),
                    'import { pathname } from "test/files/media-file.jpg";'
                );
            });
        });

        describe('videoExtensions', function () {
            it('does not transform when extension is not included in videoExtensions', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.webm"', {
                        videoExtensions: [],
                    }),
                    'import { pathname } from "test/files/media-file.webm";'
                );
            });
        });

        describe('hash', function () {
            ['md5', 'sha256', 'sha224'].forEach((algo) => {
                it(`generates a valid ${algo} hash`, function () {
                    const exe = algo + 'sum';
                    if (!executable(exe)) return this.skip();

                    const externalHash = execFileSync(exe, ['test/files/media-file.jpg'])
                        .toString()
                        .split(' ')[0];

                    const pluginHash = (transform(
                        'import {hash} from "test/files/media-file.jpg"',
                        {hash: {algo}}
                    ).match(/var hash = "([^"]+)"/i) || [])[1];

                    assert.equal(externalHash, pluginHash);
                });
            });

            it('appends md5 hash by default with {hash: true}', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        hash: true,
                    }),
                    'var pathname = "/test/files/media-file-9554735b59274a729f35768ce68ed80a.jpg";'
                );
            });

            it('can specify hash algo with {hash: {algo: <md5|sha1|...>}}', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        hash: {algo: 'sha256', length: 64},
                    }),
                    'var pathname = "/test/files/media-file-9a9542d4c6ba999a740c27f9508529235cb8d6c83104231c8f42eaf5df268676.jpg";'
                );
            });

            it('can specify hash length with {hash: {length: <positive number>}}', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        hash: {length: 10},
                    }),
                    'var pathname = "/test/files/media-file-9554735b59.jpg";'
                );
            });

            it('can specify hash delimiter with {hash: {delimiter: <char>}}', function () {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        hash: {length: 10, delimiter: '.'},
                    }),
                    'var pathname = "/test/files/media-file.9554735b59.jpg";'
                );
            });
        });

        describe('base64', function () {
            it('converts src attribute to base64 when {base64: true}', function () {
                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.jpg')
                ).toString('base64');

                assert.equal(
                    transform('import {src} from "test/files/media-file.jpg"', {
                        base64: true,
                    }),
                    `var src = "data:image/jpeg;base64,${b64str}";`
                );
            });

            it('skips files > 8kb by default', function () {
                assert.equal(
                    transform('import {src} from "test/files/media-file.large.jpg"', {
                        base64: true,
                    }),
                    'var src = "/test/files/media-file.large.jpg";'
                );
            });

            it('can override the maximum with {base64: {maxSize: <positive number>}}', function () {
                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.large.jpg')
                ).toString('base64');

                assert.equal(
                    transform('import {src} from "test/files/media-file.large.jpg"', {
                        base64: {maxSize: 20000},
                    }),
                    `var src = "data:image/jpeg;base64,${b64str}";`
                );
            });
        });
    });

    describe('with @babel/plugin-proposal-export-default-from', function () {
        it('can default export a media file using default export from', function () {
            assert.equal(
                transform(
                    'export mediaFile from "test/files/media-file.jpg"',
                    {},
                    {pluginsBefore: ['@babel/plugin-proposal-export-default-from']}
                ),
                [
                    'export default {',
                    '  pathname: "/test/files/media-file.jpg",',
                    '  src: "/test/files/media-file.jpg",',
                    '  type: "jpeg",',
                    '  width: 280,',
                    '  height: 280,',
                    '  aspectRatio: 1,',
                    '  heightToWidthRatio: 1',
                    '};',
                ].join('\n')
            );
        });
    });
});
