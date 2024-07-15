import { generateSDF } from '../dist/fastsdf.es.js';

document.getElementById('my-button')!.addEventListener('click', async () => {
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
});
