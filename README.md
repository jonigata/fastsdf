# FastSDF

This package provides a simple way to generate Signed Distance Fields (SDFs) from images using WebGL.

## Installation

You can install this package using npm:

```bash
npm install fastsdf
```

## Usage

Here's a basic example of how to use the `generateSDF` function:

```javascript
import { generateSDF } from 'fastsdf';

const srcImg = new Image();
srcImg.onload = () => {
  const sdfImg = generateSDF(srcImg, 10 /*maxDist*/, 0.25 /*dstAlphaThreshold*/);
  document.body.appendChild(sdfImg);
};
srcImg.src = 'path/to/your/image.png';
```

## API

### generateSDF(srcImg: HTMLImageElement): HTMLImageElement

Generates a Signed Distance Field from the input image.

- `srcImg`: The source image as an HTMLImageElement.
- `maxDist`: The maximum distance to consider for the SDF.
- `dstAlphaThreshold`: The threshold for the destination alpha channel. if the alpha is greater than this value, destination alpha is set to 1.0. if the alpha is less than this value, destination alpha is set to 0.0. if this value is null, destination alpha is set to the alpha of the calculated SDF.
- Returns: A new HTMLImageElement containing the generated SDF.

## How it works

The `generateSDF` function uses WebGL to efficiently generate a Signed Distance Field from the input image. It performs the following steps:

1. Creates a WebGL context with appropriate size.
2. Generates a Nearest Seed Field (NSF) from the input image.
3. Generates an inverted NSF from the input image.
4. Combines the two NSFs to create the final SDF.
5. Returns the result as a new image with the same dimensions as the input.

## Notes

- This package requires WebGL2 support in the browser.
- The input image should be loaded before calling `generateSDF`.
- The generated SDF is returned as a new image, preserving the original image's dimensions.
- The SDF is represented in the alpha channel of the output image, where 0.5 is the boundary, values < 0.5 are inside the shape, and values > 0.5 are outside. This is the case when `dstAlphaThreshold` is null.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you find a bug or have a suggestion, please file an issue on the GitHub repository.