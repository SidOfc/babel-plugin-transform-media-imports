# babel-plugin-transform-media-imports ![npm](https://img.shields.io/npm/v/babel-plugin-transform-media-imports) [![Build Status](https://travis-ci.org/SidOfc/babel-plugin-transform-media-imports.svg?branch=master)](https://travis-ci.org/SidOfc/babel-plugin-transform-media-imports)

_note:_ If you are reading this on npm, please note that this README is only updated
_per release_. Sometimes deficiencies in the README are fixed in master but not yet
published so make sure to check the github (and open an issue :D) page if something here is incorrect!

When building an application using server-side rendering, the need to
calculate aspect ratio's from image or video files in order to prevent
layout jank often arises.
While looking for alternatives &mdash; as to not have to write this
myself &mdash; I stumbled upon some other packages:

- [babel-plugin-transform-assets-import-to-string](https://github.com/yeojz/babel-plugin-transform-assets-import-to-string)
- [babel-plugin-file-loader](https://github.com/sheerun/babel-plugin-file-loader)

These seem to primarily concern themselves with outputting a prefixed
path based off of the import statement, however. This does not include getting
the `width`, `height`, or `aspectRatio` of a given image / video.
This plugin attempts to solve these issues by providing a simple way to
get what you need without having to jump through many hoops / module bundlers.

Transforms the following:

```js
import avatar from 'avatar.jpg';
```

Into:

```js
var avatar = {
    pathname: '/avatar.jpg',
    src: '/avatar.jpg',
    width: 280,
    height: 280,
    aspectRatio: 1,
    heightToWidthRatio: 1,
    type: 'jpg'
};
```

# Table of Contents

- [babel-plugin-transform-media-imports](#babel-plugin-transform-media-imports)
- [Table of Contents](#table-of-contents)
- [Changelog](#changelog)
    - [28-01-2021 v1.4.0](#28-01-2021-v140)
    - [09-08-2019 v1.3.0](#09-08-2019-v130)
    - [08-08-2019 v1.2.0](#08-08-2019-v120)
    - [05-08-2019 v1.1.1](#05-08-2019-v111)
- [Binary dependencies](#binary-dependencies)
- [Node support](#node-support)
- [Installation](#installation)
- [Usage](#usage)
    - [Importing an image](#importing-an-image)
    - [Exporting an image](#exporting-an-image)
    - [Importing specific properties](#importing-specific-properties)
    - [Exporting specific properties](#exporting-specific-properties)
- [Configuration](#configuration)
    - [baseDir](#basedir)
    - [pathnamePrefix](#pathnameprefix)
    - [outputRoot](#outputroot)
    - [imageExtensions](#imageextensions)
    - [videoExtensions](#videoextensions)
    - [hash](#hash)
    - [base64](#base64)

# Changelog

_dates are listed in dd-mm-yyyy format_

### 28-01-2021 v1.4.0

- Update dependencies (should have been a patch update, woops!)

### 09-08-2019 v1.3.0

- Add `mkdirp` dependency, back to 2 deps :/
- Fix issues with creating directories recursively in older (< 10.0.0) node versions

### 08-08-2019 v1.2.0

- Add ability to output files with [outputRoot](#outputroot).
- Remove `md5-file` dependency, it's only 1 dep now :boom:.
- Make `.svg` file content available through a `content` property.
- Rename `md5` option to `hash`, `md5` now gets aliassed to `hash` for backwards compat.
    - Add `algo` option to specify a valid node crypto hash algorithm.

### 05-08-2019 v1.1.1

- Added meta information

# Binary dependencies

This plugin depends on `ffprobe` to be installed and executable on the system
in order to get information about video formats such as `mp4` and `webm`.
`ffprobe` comes installed with [`ffmpeg`](https://ffmpeg.org/download.html).
Without `ffprobe` installed, images can still be processed.

# Node support

This plugin is tested in the following NodeJS versions:

- Node.js 15.0.0
- Node.js 14.0.0
- Node.js 13.0.0
- Node.js 12.0.0
- Node.js 11.0.0
- Node.js 10.15.0

The plugin itself may work in older versions such as node 9 or maybe even 8
but mocha requires at least node version 10.13 for running tests.

# Installation

Add this plugin to your package / application with:

_npm_:

```bash
npm install -S babel-plugin-transform-media-imports
```

_yarn_:

```bash
yarn add babel-plugin-transform-media-imports
```

Afterwards, add the plugin to your `.babelrc` plugins:

```js
{
    "plugins": ["transform-media-imports"]
}
```

# Usage

After following the [installation](#installation) steps above, you can now directly `import`
images and videos into your JS files. This will result in an object with some useful properties:

- `pathname` the path of the file with [baseDir](#basedir) removed and [pathnamePrefix](#pathnameprefix) prepended.
- `src` the same as `pathname` unless [base64](#base64) was specified and the file size was less than `base64.maxSize`.
- `hash` when [hash](#hash) is enabled, this property contains the generated hash, `undefined` otherwise.
- `type` type of the media file, e.g. `'jpg'`, `'svg'`, `'mp4'`
- `width` width in pixels of the media file
- `height` height in pixels of the media file
- `content` if the file is an `svg`, the `content` property will contain the raw svg file contents.
- `aspectRatio` calculated aspect ratio using `width / height` rounded to 3 decimal places.
- `heightToWidthRatio` calculated ratio using `height / width` rounded to 3 decimal places.<br>
  (useful for ::after padding aspect ratio hack)

## Importing an image

To `import` an image including all its properties:

```js
import image from 'path/to/image.jpg';
```

Which will be transformed into:

```js
var image = {
    pathname: 'path/to/image.jpg',
    src: 'path/to/image.jpg',
    width: 1234,
    height: 1234,
    aspectRatio: 1,
    heightToWidthRatio: 1,
    type: 'jpg'
};
```

## Exporting an image

To `export` an image including all its properties:

```js
export {default as image} from 'path/to/image.jpg';
```

When using [\@babel/plugin-proposal-export-default-from](https://babeljs.io/docs/en/next/babel-plugin-proposal-export-default-from.html),
a default export can be used instead:

```js
export image from 'path/to/image.jpg';
```

Either will be transformed into:

```js
const _image = {
    pathname: 'path/to/image.jpg',
    src: 'path/to/image.jpg',
    width: 1234,
    height: 1234,
    aspectRatio: 1,
    heightToWidthRatio: 1,
    type: 'jpg'
};
export { _image as image };
```

## Importing specific properties

If you only need to `import` a specific property, members may be imported using named imports:

```js
import {width, height, heightToWidthRatio} from 'path/to/image.jpg';
```

Which will be transformed into:

```js
const width = 1234;
const height = 1234;
const heightToWidthRatio = 1;
```

## Exporting specific properties

If you only need to `export` a specific property, members may be exported using named exports:

```js
export {width, height, heightToWidthRatio} from 'path/to/image.jpg';
```

Which will be transformed into:

```js
export const width = 1234;
export const height = 1234;
export const heightToWidthRatio = 1;
```

# Configuration

This is the default configuration of the plugin, each option is detailed below:

```js
[
    'transform-media-imports',
    {
        baseDir: process.cwd(),
        pathnamePrefix: '',
        outputRoot: null,
        imageExtensions: ['jpeg', 'apng', ...require('image-size').types],
        videoExtensions: ['mp4', 'webm', 'ogv'],
        hash: false,
        base64: false
    }
]
```

## baseDir

**default**: `process.cwd()`

Everything before this path gets removed from the `src` and `pathname` attributes.

## pathnamePrefix

**default**: `''`

After removing the [`baseDir`](#basedir), the `pathnamePrefix` gets _prepended_ to
the `src` and `pathname` attributes.

## outputRoot

**default**: `null`

When specified, writes output file(s) to `outputRoot/{pathname}` where `pathname`
is the specified media file's `pathname` attribute.

## imageExtensions

**default**: `['jpeg', 'apng', ...require('image-size').types]`

Specify supported image extensions that will be transformed.
By default, all extensions that [`image-size`](https://github.com/image-size/image-size)
supports are added to the list in addition to prepending `'jpeg'` and `'apng'` to allow
for regex matching of files using that extension as well.

## videoExtensions

**default**: `['mp4', 'webm', 'ogv']`

Specify supported video extensions that will be transformed.

## hash

_formerly named `md5`, the old name is still supported and will work the same way_

**default**: `null`

When set to `true`, adds a hash to the `src` and `pathname` attributes:

```js
import {pathname} from 'avatar.jpg';
```

Transforms into:

```js
const pathname = 'avatar-3h2jk5gjkh35guighjg3hj5ghdjkahd34kj.jpg'
```

When set to an object, adds an md5 hash configured by it. The following properties
are configurable:

```js
{
    length: 10, // trims md5 length to first <N> characters
    delimiter: '.', // delimiter to join filename and md5: [filename][delimiter][md5].[ext]
    algo: 'md5' // a valid node 'crypto' createHash algorithm such as md5 or sha256, defaults to md5
}
```

After applying the above configuration the import looks like this:

```js
const pathname = 'avatar.3h2jk5gjkh.jpg'
```

## base64

**default**: `null`

When set to `true`, sets the `src` attribute to the base64 string including
web mime type when the file is `<= 8192` bytes:

```js
import {src} from 'avatar.jpg';
```

Transforms into:

```js
var src = 'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4QCCRXhp...'
```

When set to an object, the `maxSize` of `8192` may be overridden:

```js
{
    maxSize: 10000 // allow files up to 10kb to be transformed to base64
}
```
