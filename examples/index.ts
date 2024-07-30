import { JFACompute, Computron, FloatField, generateDF, generateSDF } from '../dist/fastsdf.es.js';

// 計測
async function measureTime<T>(label: string, f: () => Promise<T>): Promise<void> {
  const start = performance.now();
  const t: T = await f();
  const end = performance.now();
  console.log(`[${label}] Time: ${end - start}ms`);
  return this;
}


document.getElementById('my-button')!.addEventListener('click', async () => {
    const color = { r: 0.5, g: 0.8, b: 0.3 };

    const start = performance.now();

    let jfa: JFACompute;
    await measureTime('Init', async () => {
        const c = new Computron();
        await c.init();

        jfa = new JFACompute(c);
        await jfa.init();
    });

    const sourcePicture = document.querySelector<HTMLImageElement>('#source-picture')!;

    let plainImage: FloatField;
    await measureTime('Convert from source image', async () => {
        plainImage = FloatField.createFromImage(sourcePicture);
        //floatField = FloatField.createWithRandomSeeds(256, 256);
    });
    document.getElementById('result')!.appendChild(plainImage!.toCanvas());

    let seedMap: FloatField;
    await measureTime('convert to SeedMap', async () => {
        seedMap = JFACompute.createJFASeedMap(plainImage, 0.5, false);
    });

    let cookedData: FloatField;
    await measureTime('Compute', async () => {
        cookedData = await jfa!.compute(seedMap!);
        // cookedData = await jfa!.compute(floatField.width, floatField.height);
    });

    let distanceField: FloatField;
    await measureTime('Generate distance field', async () => {
        distanceField = JFACompute.generateDistanceField(cookedData, color, 10, 0.5);
    });

    let dataCanvas: HTMLCanvasElement;
    await measureTime('toCanvas', async () => {
        dataCanvas = distanceField.toCanvas();
    });

    const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(dataCanvas!, 0, 0);

    document.getElementById('result')!.appendChild(dataCanvas!);

    await measureTime('Generate signed distance field', async () => {
        const reveresedSeedMap = JFACompute.createJFASeedMap(plainImage, 0.5, true);
        const reveresedCookedData = await jfa!.compute(reveresedSeedMap);
        const sdf = JFACompute.generateSignedDistanceField(
            cookedData, reveresedCookedData, color, 10, 0.9
        );
        const sdfCanvas = sdf.toCanvas();
        document.getElementById('result')!.appendChild(sdfCanvas);
    });

    await measureTime('Generate distance field (high level API)', async () => {
        const sdfCanvas = await generateDF(sourcePicture, color, 0.5, false, 20, null);
        document.getElementById('result')!.appendChild(sdfCanvas);
    });

    await measureTime('Generate signed distance field (high level API)', async () => {
        const sdfCanvas = await generateSDF(sourcePicture, color, 0.5, 10, 0.5);
        document.getElementById('result')!.appendChild(sdfCanvas);
    });

    // await testRedShader();
});
