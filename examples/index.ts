import { JFACompute, Computron, FloatField, testRedShader } from '../dist/fastsdf.es.js';

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

    let floatField: FloatField;
    await measureTime('Convert from source image', async () => {
        const sourcePicture = document.querySelector<HTMLImageElement>('#source-picture')!;
        // floatField = FloatField.createFromImage(sourcePicture);
        floatField = FloatField.createWithRandomSeeds(256, 256);
        console.log(floatField.analyzeAlpha());
    });

    let cookedData: FloatField;
    await measureTime('Compute', async () => {
        cookedData = await jfa!.compute(floatField!);
        // cookedData = await jfa!.compute(floatField.width, floatField.height);
        console.log(cookedData.analyzeAlpha());
    });

    let dataCanvas: HTMLCanvasElement;
    await measureTime('toCanvas', async () => {
        dataCanvas = cookedData.toCanvas();
    });

    const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(dataCanvas!, 0, 0);

    document.getElementById('result')!.appendChild(dataCanvas!);

   // await testRedShader();
});
