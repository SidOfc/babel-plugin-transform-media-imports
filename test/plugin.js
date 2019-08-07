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
    describe('with @babel/plugin-proposal-export-default-from', function() {
        it('can default export a media file using default export from', function() {
            const code = transform('export mediaFile from "test/files/media-file.jpg"');

            assert.equal(
                code,
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

    it('can default export a media file using named exports', function() {
        if (!ffprobeInstalled) return this.skip();

        const code = transform('export {default} from "test/files/media-file.webm"');

        assert.equal(
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
            ].join('\n'),
            code
        );
    });

    it('can export a property from the media file', function() {
        const code = transform(
            'export {width, height as h} from "test/files/media-file.jpg"'
        );

        assert.equal(
            ['export const width = 280;', 'export const h = 280;'].join('\n'),
            code
        );
    });

    it('converts default import to object with information', function() {
        const code = transform('import a from "test/files/media-file.jpg"');

        assert.equal(
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
            ].join('\n'),
            code
        );
    });

    it('converts named imports to variable declarations', function() {
        const code = transform(
            'import {pathname, width as aw, aspectRatio} from "test/files/media-file.jpg"'
        );
        assert.equal(
            [
                'var pathname = "/test/files/media-file.jpg";',
                'var aw = 280;',
                'var aspectRatio = 1;'
            ].join('\n'),
            code
        );
    });

    describe('options', function() {
        describe('baseDir', function() {
            it('removes provided baseDir from output pathname', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        baseDir: 'test'
                    }
                );

                assert.equal('var pathname = "/files/media-file.jpg";', code);
            });

            it('removes process.cwd() from output pathname by default', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"'
                );

                assert.equal('var pathname = "/test/files/media-file.jpg";', code);
            });
        });

        describe('pathnamePrefix', function() {
            it('prepends pathnamePrefix if specified', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        pathnamePrefix: '/assets'
                    }
                );

                assert.equal('var pathname = "/assets/test/files/media-file.jpg";', code);
            });

            it('prepends nothing by default', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"'
                );

                assert.equal('var pathname = "/test/files/media-file.jpg";', code);
            });
        });

        describe('imageExtensions', function() {
            it('does not transform when extension is not included in imageExtensions', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {imageExtensions: []}
                );

                assert.equal(
                    'import { pathname } from "test/files/media-file.jpg";',
                    code
                );
            });
        });

        describe('videoExtensions', function() {
            it('does not transform when extension is not included in videoExtensions', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.webm"',
                    {videoExtensions: []}
                );

                assert.equal(
                    'import { pathname } from "test/files/media-file.webm";',
                    code
                );
            });
        });

        describe('md5', function() {
            it('appends full md5 hash when {md5: true}', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        md5: true
                    }
                );
                assert.equal(
                    'var pathname = "/test/files/media-file-9554735b59274a729f35768ce68ed80a.jpg";',
                    code
                );
            });

            it('can specify md5 length with {md5: {length: <positive number>}}', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        md5: {length: 10}
                    }
                );

                assert.equal(
                    'var pathname = "/test/files/media-file-9554735b59.jpg";',
                    code
                );
            });

            it('can specify md5 delimiter with {md5: {delimiter: <char>}}', function() {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        md5: {length: 10, delimiter: '.'}
                    }
                );

                assert.equal(
                    'var pathname = "/test/files/media-file.9554735b59.jpg";',
                    code
                );
            });
        });

        describe('base64', function() {
            it('converts src attribute to base64 when {base64: true}', function() {
                const code = transform('import {src} from "test/files/media-file.jpg"', {
                    base64: true
                });

                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.jpg')
                ).toString('base64');

                assert.equal(`var src = "data:image/jpg;base64,${b64str}";`, code);
            });

            it('skips files > 8kb by default', function() {
                const code = transform('import {src} from "test/files/media-file.webm"', {
                    base64: true
                });

                assert.equal(`var src = "/test/files/media-file.webm";`, code);
            });

            it('can override the maximum with {base64: {maxSize: <positive number>}}', function() {
                const code = transform('import {src} from "test/files/media-file.webm"', {
                    base64: {maxSize: 10000}
                });

                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.webm')
                ).toString('base64');

                assert.equal(`var src = "data:video/webm;base64,${b64str}";`, code);
            });
        });
    });
});
