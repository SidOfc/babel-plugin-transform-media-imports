import assert from 'assert';
import * as babel from '@babel/core';
import hasbin from 'hasbin';
import fs from 'fs';
import path from 'path';

const ffprobeInstalled = hasbin.sync('ffprobe');

function transform(code, options = {}) {
    return babel.transform(code, {
        presets: [['@babel/preset-env', {modules: false}]],
        plugins: [['@babel/plugin-proposal-export-default-from'], ['./index', options]]
    }).code;
}

describe('babel-plugin-transform-media-imports', function() {
    it('can default export a media file using named exports', function() {
        if (!ffprobeInstalled) return this.skip();

        assert.equal(
            transform('export {default} from "test/files/media-file.webm"'),
            [
                'export default {',
                '  pathname: "/test/files/media-file.webm",',
                '  src: "/test/files/media-file.webm",',
                '  type: "webm",',
                '  width: 768,',
                '  height: 180,',
                '  aspectRatio: 4.267,',
                '  heightToWidthRatio: 0.234',
                '};'
            ].join('\n')
        );
    });

    it('can export a property from the media file', function() {
        assert.equal(
            transform('export {width, height as h} from "test/files/media-file.jpg"'),
            'export const width = 280;\nexport const h = 280;'
        );
    });

    it('makes file content available for .svg files', function() {
        const svgContent = fs
            .readFileSync('test/files/media-file.svg')
            .toString()
            .replace(/(?<!\\)"/g, '\\"')
            .replace(/\n/g, '\\n');

        assert.equal(
            transform('import {content} from "test/files/media-file.svg"'),
            `var content = "${svgContent}";`
        );
    });

    it('converts default import to object with information', function() {
        assert.equal(
            transform('import a from "test/files/media-file.jpg"'),
            [
                'var a = {',
                '  pathname: "/test/files/media-file.jpg",',
                '  src: "/test/files/media-file.jpg",',
                '  type: "jpg",',
                '  width: 280,',
                '  height: 280,',
                '  aspectRatio: 1,',
                '  heightToWidthRatio: 1',
                '};'
            ].join('\n')
        );
    });

    it('converts named imports to variable declarations', function() {
        assert.equal(
            transform('import {pathname, width as aw} from "test/files/media-file.jpg"'),
            'var pathname = "/test/files/media-file.jpg";\nvar aw = 280;'
        );
    });

    describe('options', function() {
        describe('baseDir', function() {
            it('removes provided baseDir from output pathname', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        baseDir: 'test'
                    }),
                    'var pathname = "/files/media-file.jpg";'
                );
            });

            it('removes process.cwd() from output pathname by default', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"'),
                    'var pathname = "/test/files/media-file.jpg";'
                );
            });
        });

        describe('pathnamePrefix', function() {
            it('prepends pathnamePrefix if specified', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        pathnamePrefix: '/assets'
                    }),
                    'var pathname = "/assets/test/files/media-file.jpg";'
                );
            });

            it('prepends nothing by default', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"'),
                    'var pathname = "/test/files/media-file.jpg";'
                );
            });
        });

        describe('imageExtensions', function() {
            it('does not transform when extension is not included in imageExtensions', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        imageExtensions: []
                    }),
                    'import { pathname } from "test/files/media-file.jpg";'
                );
            });
        });

        describe('videoExtensions', function() {
            it('does not transform when extension is not included in videoExtensions', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.webm"', {
                        videoExtensions: []
                    }),
                    'import { pathname } from "test/files/media-file.webm";'
                );
            });
        });

        describe('md5', function() {
            it('appends full md5 hash when {md5: true}', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        md5: true
                    }),
                    'var pathname = "/test/files/media-file-9554735b59274a729f35768ce68ed80a.jpg";'
                );
            });

            it('can specify md5 length with {md5: {length: <positive number>}}', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        md5: {length: 10}
                    }),
                    'var pathname = "/test/files/media-file-9554735b59.jpg";'
                );
            });

            it('can specify md5 delimiter with {md5: {delimiter: <char>}}', function() {
                assert.equal(
                    transform('import {pathname} from "test/files/media-file.jpg"', {
                        md5: {length: 10, delimiter: '.'}
                    }),
                    'var pathname = "/test/files/media-file.9554735b59.jpg";'
                );
            });
        });

        describe('base64', function() {
            it('converts src attribute to base64 when {base64: true}', function() {
                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.jpg')
                ).toString('base64');

                assert.equal(
                    transform('import {src} from "test/files/media-file.jpg"', {
                        base64: true
                    }),
                    `var src = "data:image/jpg;base64,${b64str}";`
                );
            });

            it('skips files > 8kb by default', function() {
                assert.equal(
                    transform('import {src} from "test/files/media-file.webm"', {
                        base64: true
                    }),
                    'var src = "/test/files/media-file.webm";'
                );
            });

            it('can override the maximum with {base64: {maxSize: <positive number>}}', function() {
                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.webm')
                ).toString('base64');

                assert.equal(
                    transform('import {src} from "test/files/media-file.webm"', {
                        base64: {maxSize: 10000}
                    }),
                    `var src = "data:video/webm;base64,${b64str}";`
                );
            });
        });
    });

    describe('with @babel/plugin-proposal-export-default-from', function() {
        it('can default export a media file using default export from', function() {
            assert.equal(
                transform('export mediaFile from "test/files/media-file.jpg"'),
                [
                    'var _mediaFile = {',
                    '  pathname: "/test/files/media-file.jpg",',
                    '  src: "/test/files/media-file.jpg",',
                    '  type: "jpg",',
                    '  width: 280,',
                    '  height: 280,',
                    '  aspectRatio: 1,',
                    '  heightToWidthRatio: 1',
                    '};',
                    'export { _mediaFile as mediaFile };'
                ].join('\n')
            );
        });
    });
});
