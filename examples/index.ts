import { JFACompute, Computron, FloatField } from '../dist/fastsdf.es.js';

// 計測
async function measureTime<T>(label: string, f: () => Promise<T>): Promise<void> {
  const start = performance.now();
  const t: T = await f();
  const end = performance.now();
  console.log(`[${label}] Time: ${end - start}ms`);
  return this;
}


document.getElementById('my-button')!.addEventListener('click', async () => {
    const start = performance.now();

    let jfa: JFACompute;
    await measureTime('Init', async () => {
        const c = new Computron();
        await c.init();

        jfa = new JFACompute(c);
        await jfa.init();
    });

    let plainImage: FloatField;
    await measureTime('Convert from source image', async () => {
        const sourcePicture = document.querySelector<HTMLImageElement>('#source-picture')!;
        plainImage = FloatField.createFromImage(sourcePicture);
        //floatField = FloatField.createWithRandomSeeds(256, 256);
    });
    document.getElementById('result')!.appendChild(plainImage!.toCanvas());

    let seedMap: FloatField;
    await measureTime('convert to JFA', async () => {
        seedMap = JFACompute.createJFASeedMap(plainImage, 0.5, false);
    });

    let cookedData: FloatField;
    await measureTime('Compute', async () => {
        cookedData = await jfa!.compute(seedMap!);
        // cookedData = await jfa!.compute(floatField.width, floatField.height);
    });

    let distanceField: FloatField;
    await measureTime('convert from JFA', async () => {
        distanceField = JFACompute.generateDistanceField(cookedData, 10);
    });

    let dataCanvas: HTMLCanvasElement;
    await measureTime('toCanvas', async () => {
        dataCanvas = distanceField.toCanvas();
    });

    const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(dataCanvas!, 0, 0);

    document.getElementById('result')!.appendChild(dataCanvas!);

   // await testRedShader();
});
