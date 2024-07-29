import { Computron } from "./Computron";
import { JFACompute, Curve } from "./JFACompute";
import { FloatField } from "./FloatField";

export async function generateNearestNeighbourMap(
  src: HTMLImageElement | HTMLCanvasElement, 
  srcAlphaThreshold: number): Promise<FloatField> {

  const c = new Computron();
  await c.init();

  const jfa = new JFACompute(c);
  await jfa.init();

  const plainImage = FloatField.createFromImageOrCanvas(src);

  const seedMap = JFACompute.createJFASeedMap(plainImage, srcAlphaThreshold, false);
  const cookedData = await jfa!.compute(seedMap!);
  return cookedData;
}

export async function generateDF(
  src: HTMLImageElement | HTMLCanvasElement, 
  color: {r: number, g: number, b: number}, 
  srcAlphaThreshold: number,
  inverseAlpha: boolean,
  maxDistance: number,
  dstAlphaThreshold: number | Curve | null): Promise<HTMLCanvasElement> {

  const c = new Computron();
  await c.init();

  const jfa = new JFACompute(c);
  await jfa.init();
  
  const plainImage = FloatField.createFromImageOrCanvas(src);

  const seedMap = JFACompute.createJFASeedMap(plainImage, srcAlphaThreshold, inverseAlpha);
  const cookedData = await jfa!.compute(seedMap!);

  const distanceField = JFACompute.generateDistanceField(
    cookedData, color, maxDistance, dstAlphaThreshold);
  const dataCanvas = distanceField.toCanvas();
  return dataCanvas;
}

export async function generateSDF(
  src: HTMLImageElement | HTMLCanvasElement, 
  color: {r: number, g: number, b: number}, 
  srcAlphaThreshold: number,
  maxDistance: number,  
  dstAlphaThreshold: number | Curve | null): Promise<HTMLCanvasElement> {

  const c = new Computron();
  await c.init();

  const jfa = new JFACompute(c);
  await jfa.init();

  const plainImage = FloatField.createFromImageOrCanvas(src);

  const seedMap = JFACompute.createJFASeedMap(plainImage, srcAlphaThreshold, false);
  const cookedData = await jfa!.compute(seedMap!);

  const inversedSeedMap = JFACompute.createJFASeedMap(plainImage, srcAlphaThreshold, true);
  const inversedCookedData = await jfa!.compute(inversedSeedMap);

  const sdf = JFACompute.generateSignedDistanceField(
      cookedData, inversedCookedData, color, maxDistance, dstAlphaThreshold
  );
  const sdfCanvas = sdf.toCanvas();
  return sdfCanvas;
}
