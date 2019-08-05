import assert from 'assert';
import * as babel from '@babel/core';
import fs from 'fs';
import path from 'path';

function transform(code, options = {}) {
    return babel.transform(code, {
        presets: [['@babel/preset-env', {modules: false}]],
        plugins: [['@babel/plugin-proposal-export-default-from'], ['./index', options]]
    }).code;
}

describe('babel-plugin-transform-media-imports', () => {
    describe('with @babel/plugin-proposal-export-default-from', () => {
        it('can default export a media file using default export from', () => {
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

    it('can default export a media file using named exports', () => {
        const code = transform('export {default} from "test/files/media-file.jpg"');

        assert.equal(
            [
                'export default {',
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

    it('can export a property from the media file', () => {
        const code = transform(
            'export {width, height as h} from "test/files/media-file.jpg"'
        );

        assert.equal(
            ['export const width = 280;', 'export const h = 280;'].join('\n'),
            code
        );
    });

    it('converts default import to object with information', () => {
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

    it('converts named imports to variable declarations', () => {
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

    describe('options', () => {
        describe('baseDir', () => {
            it('removes provided baseDir from output pathname', () => {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        baseDir: 'test'
                    }
                );

                assert.equal('var pathname = "/files/media-file.jpg";', code);
            });

            it('removes process.cwd() from output pathname by default', () => {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"'
                );

                assert.equal('var pathname = "/test/files/media-file.jpg";', code);
            });
        });

        describe('pathnamePrefix', () => {
            it('prepends pathnamePrefix if specified', () => {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"',
                    {
                        pathnamePrefix: '/assets'
                    }
                );

                assert.equal('var pathname = "/assets/test/files/media-file.jpg";', code);
            });

            it('prepends nothing by default', () => {
                const code = transform(
                    'import {pathname} from "test/files/media-file.jpg"'
                );

                assert.equal('var pathname = "/test/files/media-file.jpg";', code);
            });
        });

        describe('imageExtensions', () => {
            it('does not transform when extension is not included in imageExtensions', () => {
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

        describe('videoExtensions', () => {
            it('does not transform when extension is not included in videoExtensions', () => {
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

        describe('md5', () => {
            it('appends full md5 hash when {md5: true}', () => {
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

            it('can specify md5 length with {md5: {length: <positive number>}}', () => {
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

            it('can specify md5 delimiter with {md5: {delimiter: <char>}}', () => {
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

        describe('base64', () => {
            it('converts src attribute to base64 when {base64: true}', () => {
                const code = transform('import {src} from "test/files/media-file.jpg"', {
                    base64: true
                });

                const b64str = Buffer.from(
                    fs.readFileSync('test/files/media-file.jpg')
                ).toString('base64');

                assert.equal(`var src = "data:image/jpg;base64,${b64str}";`, code);
            });

            it('skips files > 8kb by default', () => {
                const code = transform('import {src} from "test/files/media-file.webm"', {
                    base64: true
                });

                assert.equal(`var src = "/test/files/media-file.webm";`, code);
            });

            it('can override the maximum with {base64: {maxSize: <positive number>}}', () => {
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
