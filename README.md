# :construction: babel-plugin-transform-media-imports :construction:

:warning: This plugin is still under construction and is **not completely functional!** :warning:

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

## Binary dependencies

This plugin depends on `ffprobe` to be installed and executable on the system
in order to get information about video formats such as `mp4` and `webm`.
`ffprobe` comes installed with [`ffmpeg`](https://ffmpeg.org/download.html).
Without `ffprobe` installed, images can still be processed.

## Installation

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

## Configuration

### baseDir

**default**: `'/assets'`

Everything before this path gets removed from the `src` and `pathname` attributes.

### outputPrefix

**default**: `'/assets'`

After removing the [`baseDir`](#basedir), the `outputPrefix` gets _prepended_ to
the `src` and `pathname` attributes.

### imageExtensions

**default**: `['svg', 'apng', 'png', 'gif', 'jpg', 'jpeg']`

Specify supported image extensions that will be transformed.

### videoExtensions

**default**: `[mp4, webm, ogv]`

Specify supported video extensions that will be transformed.

### md5

**default**: `null`

When set to `true`, adds an md5 hash to the `src` and `pathname` attributes:

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
    delimiter: '.' // delimiter to join filename and md5: [filename][delimiter][md5].[ext]
}
```

After applying the above configuration the import looks like this:

```js
const pathname = 'avatar.3h2jk5gjkh.jpg'
```


### base64

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

