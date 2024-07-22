export class FloatField {
  constructor(
    public width: number,
    public height: number,
    public data: Float32Array
  ) {
    if (data.length !== width * height * 4) {
      throw new Error("Data size does not match width and height");
    }
  }

  static createEmpty(width: number, height: number): FloatField {
    return new FloatField(width, height, new Float32Array(width * height * 4));
  }

  static createWithRandomSeeds(width: number, height: number, seedDensity: number = 0.01): FloatField {
    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < seedDensity) {
        data[i] = (i / 4) % width;
        data[i + 1] = Math.floor((i / 4) / width);
        data[i + 2] = 1.0;  // シードポイントのマーカー
      } else {
        data[i] = data[i + 1] = -1.0;  // 非シードポイント
      }
      data[i + 3] = 1.0;
    }
    return new FloatField(width, height, data);
  }
}
