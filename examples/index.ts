import { JFACompute, Computron } from '../dist/fastsdf.es.js';


document.getElementById('my-button')!.addEventListener('click', async () => {
    const start = performance.now();
    const c = new Computron();
    await c.init();

    const jfa = new JFACompute(c);
    await jfa.init();

    // 時間計測
    const mid = performance.now();
    const w = 256;
    const h = 256;
    const data = new Float32Array(w * h * 4);
    const cookedData = await jfa.compute(data, w, h);
    const end = performance.now();
    console.log(`Total Time: ${end - start}ms, Init Time: ${mid - start}ms, Compute Time: ${end - mid}ms`);

/*
    const img = new Image();
    img.src = './picture.png';
    await img.decode();
    console.log(img.width, img.height);
    // document.body.appendChild(img);
    
    const sdf = generateSDF(img, 10, 0.25);
    console.log(sdf.width, sdf.height);
    const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    ctx.drawImage(sdf, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'cyan';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.drawImage(img, 0, 0);

    document.getElementById('result')!.appendChild(sdf);
*/
});
