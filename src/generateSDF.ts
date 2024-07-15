import { NearestSeedFieldGenerator } from './NearestSeedFieldGenerator';
import { SDFGenerator } from './SDFGenerator';

function generateSDF(srcImg: HTMLImageElement, maxDist: number): HTMLImageElement {
  // 2のべき乗に切り上げる関数
  const nextPowerOfTwo = (n: number) => Math.pow(2, Math.ceil(Math.log2(n)));

  // キャンバスサイズを決定（2のべき乗に切り上げ）
  const canvasWidth = nextPowerOfTwo(srcImg.width);
  const canvasHeight = nextPowerOfTwo(srcImg.height);
  console.log(canvasWidth, canvasHeight);

  // キャンバスを作成
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // NearestSeedFieldGeneratorとSDFGeneratorを初期化
  const nsfGenerator = new NearestSeedFieldGenerator(canvas);
  const sdfGenerator = new SDFGenerator(nsfGenerator);

  // アルファしきい値（必要に応じて調整）
  const alphaThreshold = 0.5;

  // 通常のNSFテクスチャを生成
  const initialTextureA = nsfGenerator.createInitialTextureFromImage(srcImg, alphaThreshold, false);
  const nsfTextureA = nsfGenerator.generate(initialTextureA);

  // アルファ反転したNSFテクスチャを生成
  const initialTextureB = nsfGenerator.createInitialTextureFromImage(srcImg, alphaThreshold, true);
  const nsfTextureB = nsfGenerator.generate(initialTextureB);

  // SDFを生成
  const sdfImg = sdfGenerator.generate(nsfTextureA, nsfTextureB, maxDist);

  // 元の画像サイズにクロップ
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = srcImg.width;
  resultCanvas.height = srcImg.height;
  const resultCtx = resultCanvas.getContext('2d')!;
  const x = (canvasWidth - srcImg.width) / 2;
  const y = (canvasHeight - srcImg.height) / 2;
  resultCtx.drawImage(sdfImg, x, y, srcImg.width, srcImg.height, 0, 0, srcImg.width, srcImg.height);

  // 結果をHTMLImageElementとして返す
  const resultImg = new Image();
  resultImg.src = resultCanvas.toDataURL();

  return resultImg;
}

export { generateSDF };