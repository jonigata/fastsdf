# FastSDF

This package provides a simple way to generate Signed Distance Fields (SDFs) and other distance-based fields from images using WebGPU.

## Installation

You can install this package using npm:

```bash
npm install fastsdf
```

## Usage

Here are basic examples of how to use the main functions:

```javascript
import { generateSDF, generateDF, generateNearestNeighbourMap } from 'fastsdf';

// Load the source image
const srcImg = new Image();
srcImg.onload = async () => {
  // Generate a Signed Distance Field
  const sdfCanvas = await generateSDF(srcImg, 0.5, 10, 0.25);
  document.body.appendChild(sdfCanvas);

  // Generate a Distance Field
  const dfCanvas = await generateDF(srcImg, 0.5, false, 10);
  document.body.appendChild(dfCanvas);

  // Generate a Nearest Neighbour Map
  const nnMap = await generateNearestNeighbourMap(srcImg, 0.5);
  // Use nnMap as needed
};
srcImg.src = 'path/to/your/image.png';
```

## API

### generateSDF(src: HTMLImageElement | HTMLCanvasElement, srcAlphaThreshold: number, maxDistance: number, dstAlphaThreshold: number): Promise&lt;HTMLCanvasElement&gt;

Generates a Signed Distance Field from the input image.

- `src`: The source image as an HTMLImageElement or HTMLCanvasElement.
- `srcAlphaThreshold`: The alpha threshold for the source image.
- `maxDistance`: The maximum distance to consider for the SDF.
- `dstAlphaThreshold`: The threshold for the destination alpha channel.
- Returns: A Promise that resolves to an HTMLCanvasElement containing the generated SDF.

### generateDF(src: HTMLImageElement | HTMLCanvasElement, srcAlphaThreshold: number, inverseAlpha: boolean, maxDistance: number): Promise&lt;HTMLCanvasElement&gt;

Generates a Distance Field from the input image.

- `src`: The source image as an HTMLImageElement or HTMLCanvasElement.
- `srcAlphaThreshold`: The alpha threshold for the source image.
- `inverseAlpha`: Whether to invert the alpha channel.
- `maxDistance`: The maximum distance to consider for the DF.
- Returns: A Promise that resolves to an HTMLCanvasElement containing the generated DF.

### generateNearestNeighbourMap(src: HTMLImageElement | HTMLCanvasElement, srcAlphaThreshold: number): Promise&lt;FloatField&gt;

Generates a Nearest Neighbour Map from the input image.

- `src`: The source image as an HTMLImageElement or HTMLCanvasElement.
- `srcAlphaThreshold`: The alpha threshold for the source image.
- Returns: A Promise that resolves to a FloatField containing the Nearest Neighbour Map.

## How it works

The functions use WebGPU to efficiently generate various distance-based fields from the input image. The process involves:

1. Initializing a Computron and JFACompute instance.
2. Creating seed maps from the input image.
3. Computing the required fields using Jump Flooding Algorithm (JFA).
4. Generating the final output (SDF, DF, or Nearest Neighbour Map).

## Notes

- This package requires WebGPU support in the browser.
- The input image should be loaded before calling the functions.
- All main functions return Promises, so make sure to use `await` or `.then()` when calling them.
- The generated fields are returned as HTMLCanvasElement or FloatField, depending on the function.

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you find a bug or have a suggestion, please file an issue on the GitHub repository.