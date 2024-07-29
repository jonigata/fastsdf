import { Computron } from "./Computron";
import { JFACompute } from "./JFACompute";
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

export async function generateSDF(
  src: HTMLImageElement | HTMLCanvasElement, 
  srcAlphaThreshold: number,
  maxDistance: number,  
  dstAlphaThreshold: number): Promise<HTMLCanvasElement> {

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
      cookedData, inversedCookedData, maxDistance, dstAlphaThreshold
  );
  const sdfCanvas = sdf.toCanvas();
  return sdfCanvas;
}

export async function generateDF(
  src: HTMLImageElement | HTMLCanvasElement, 
  srcAlphaThreshold: number,
  inverseAlpha: boolean,
  maxDistance: number): Promise<HTMLCanvasElement> {

  const c = new Computron();
  await c.init();

  const jfa = new JFACompute(c);
  await jfa.init();
  
  const plainImage = FloatField.createFromImageOrCanvas(src);

  const seedMap = JFACompute.createJFASeedMap(plainImage, srcAlphaThreshold, inverseAlpha);
  const cookedData = await jfa!.compute(seedMap!);

  const distanceField = JFACompute.generateDistanceField(cookedData, maxDistance);
  const dataCanvas = distanceField.toCanvas();
  return dataCanvas;
}