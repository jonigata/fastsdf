export class FloatField {
  public data: Float32Array;

  constructor(
    public width: number,
    public height: number,
    data: Float32Array | null = null
  ) {
    if (data === null) {
      this.data = new Float32Array(width * height * 4);
    } else if (data.length !== width * height * 4) {
      throw new Error("Data size does not match width and height");
    } else {
      this.data = data;
    }
  }

  static createEmpty(width: number, height: number): FloatField {
    return new FloatField(width, height);
  }

  static createWithRandomSeeds(width: number, height: number, seedDensity: number = 0.01): FloatField {
    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < seedDensity) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 1.0;
      } 
    }
    return new FloatField(width, height, data);
  }

  static createFromCanvas(canvas: HTMLCanvasElement): FloatField {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Unable to get 2D context from canvas");
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const floatData = new Float32Array(imageData.data.length);

    for (let i = 0; i < imageData.data.length; i++) {
      // Convert 0-255 integer values to 0-1 float values
      floatData[i] = imageData.data[i] / 255;
    }

    return new FloatField(canvas.width, canvas.height, floatData);
  }

  static createFromImage(image: HTMLImageElement): FloatField {
    // Create a temporary canvas to draw the image
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error("Unable to get 2D context from temporary canvas");
    }

    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0);

    // Use the existing createFromCanvas method
    return FloatField.createFromCanvas(canvas);
  }
  
  toCanvas(): HTMLCanvasElement {
    // オフスクリーンcanvasの作成
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;
  
    // ImageDataオブジェクトの作成
    const imageData = ctx.createImageData(this.width, this.height);

    const data  = this.data;

    // FloatFieldのデータをImageDataに変換
    for (let i = 0; i < data.length; i += 4) {
      // FloatFieldの値を0-255の範囲にマッピング
      imageData.data[i + 0] = Math.max(0, Math.min(255, Math.floor(data[i + 0] * 255)));
      imageData.data[i + 1] = Math.max(0, Math.min(255, Math.floor(data[i + 1] * 255)));
      imageData.data[i + 2] = Math.max(0, Math.min(255, Math.floor(data[i + 2] * 255)));
      imageData.data[i + 3] = Math.max(0, Math.min(255, Math.floor(data[i + 3] * 255)));
    }
  
    // ImageDataをcanvasに描画
    ctx.putImageData(imageData, 0, 0);
  
    // canvasの内容をデータURLとして取得
    return canvas;
  }  

  analyzeAlpha(threshold: number = 0.5): {
    minAlpha: number;
    maxAlpha: number;
    pixelsAboveThreshold: number;
    totalPixels: number;
    averageAlpha: number;
  } {
    let minAlpha = Infinity;
    let maxAlpha = -Infinity;
    let sumAlpha = 0;
    let pixelsAboveThreshold = 0;
    const totalPixels = this.width * this.height;

    for (let i = 3; i < this.data.length; i += 4) {
      const alpha = this.data[i];
      
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);
      sumAlpha += alpha;

      if (alpha >= threshold) {
        pixelsAboveThreshold++;
      }
    }

    const averageAlpha = sumAlpha / totalPixels;

    return {
      minAlpha,
      maxAlpha,
      pixelsAboveThreshold,
      totalPixels,
      averageAlpha
    };
  }  

  convertToJFAFormat(alphaThreshold: number, inverseAlpha: boolean) {
    const data = this.data;
    const [w, h] = [this.width, this.height];

    for (let y = 0; y < h ; y++) {
      for (let x = 0; x < w ; x++) {
        const i = (y * w + x) * 4;
        let alpha = data[i + 3];
        if (inverseAlpha) {
          alpha = 1.0 - alpha;
        }
        
        if (alpha >= alphaThreshold) {
          // アルファ値が閾値以上ならシードとして設定
          data[i + 0] = x;
          data[i + 1] = y;
          data[i + 2] = 1.0; // 母点マーク
          data[i + 3] = 0.0;
        } else {
          // それ以外は非シード点として設定
          data[i + 0] = -1.0;
          data[i + 1] = -1.0;
          data[i + 2] = 0.0;
          data[i + 3] = 1e38;
        }
      }
    }    
  }

  convertFromJFAFormat(maxDist: number, alphaThreshold: number | null = null) {
    const data = this.data;
    const [w, h] = [this.width, this.height];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // alphaThresholdがある場合適用
        let alpha = data[i + 3];
        if (alphaThreshold != null) {
          alpha = alpha < alphaThreshold ? 0 : 1;
        }

        const [nx, ny] = [data[i + 0], data[i + 1]];
        const dist = Math.sqrt(data[i + 3]);
        const normalizedDist = dist / maxDist;
        alpha = 0.5 - (normalizedDist * 0.5); // 0.0 to 0.5
        alpha = Math.max(0, Math.min(1, alpha));
        data[i+0] = 1.0;
        data[i+1] = 1.0;
        data[i+2] = 1.0;
        data[i+3] = alpha;
      }
    }
  }
}
