export class NearestSeedFieldGenerator {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private workTextures: [WebGLTexture, WebGLTexture];
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  private iLevelLocation: WebGLUniformLocation;

  maxSteps = 10;

  constructor(private canvas: HTMLCanvasElement) {
    this.initWebGL();
    this.setupTextures();
    this.setupFramebuffers();
  }

  private initWebGL(): void {
    this.gl = this.canvas.getContext("webgl2")!;
    if (!this.gl) {
      throw new Error("WebGL2 is not supported");
    }

    const ext = this.gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      throw new Error("EXT_color_buffer_float is not supported");
    }

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const vertexShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      `#version 300 es
        in vec4 aVertexPosition;
        void main() {
          gl_Position = aVertexPosition;
        }
      `,
    );

    // EXT_texture_border_clampが使えないようなので、範囲外のテクスチャサンプリングを自前で処理

    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      `#version 300 es
        precision highp float;
        uniform sampler2D uSampler;
        out vec4 fragColor;
        uniform int iLevel;
        uniform vec2 uTextureSize;
        
        const int maxSteps = ${this.maxSteps};
  
        bool isInside(vec2 p) {
            return p.x >= 0.0 && p.x < uTextureSize.x && p.y >= 0.0 && p.y < uTextureSize.y;
        }

        vec4 sampleTexture(vec2 p) {
            if (isInside(p)) {
                return texture(uSampler, p / uTextureSize);
            } else {
                return vec4(-1.0, -1.0, -1.0, 1.0); // 範囲外の場合の値
            }
        }

        vec2 StepJFA(vec2 p, int level)
        {
            int stepLevel = clamp(maxSteps - 1 - level, 0, maxSteps);
            int w = 1 << stepLevel;
            vec2 best = sampleTexture(p).xy;
            float bestd2 = (best.x >= 0.0) ? dot(best - p, best - p) : 1e38;

            for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                    vec2 samplePos = p + vec2(x, y) * float(w);
                    vec2 seed = sampleTexture(samplePos).xy;
                    if (seed.x >= 0.0) {
                        float d2 = dot(seed - p, seed - p);
                        if (d2 < bestd2) {
                            bestd2 = d2;
                            best = seed;
                        }
                    }
                }
            }
            return best;
        }

        void main()
        {
            vec2 fc = gl_FragCoord.xy;
            vec4 pixel = sampleTexture(fc);
            if (pixel.z == 1.0) { // 母点
                fragColor = pixel;
            } else {
                vec2 seed = StepJFA(fc, iLevel);
                fragColor = vec4(seed, (seed.x >= 0.0) ? 0.0 : -1.0, 1.0);
            } 
        }       
        `,
    );

    this.program = this.gl.createProgram()!;
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    this.gl.useProgram(this.program);
    this.iLevelLocation = this.gl.getUniformLocation(
      this.program,
      "iLevel",
    )!;

    const textureSizeLocation = this.gl.getUniformLocation(this.program, "uTextureSize");
    this.gl.uniform2f(textureSizeLocation, this.canvas.width, this.canvas.height);

    this.setupBuffers();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(
        "An error occurred compiling the shaders: " +
          this.gl.getShaderInfoLog(shader),
      );
    }
    return shader;
  }

  private setupBuffers(): void {
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(positions),
      this.gl.STATIC_DRAW,
    );

    const positionAttributeLocation = this.gl.getAttribLocation(
      this.program,
      "aVertexPosition",
    );
    this.gl.enableVertexAttribArray(positionAttributeLocation);
    this.gl.vertexAttribPointer(
      positionAttributeLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );
  }

  private setupTextures(): void {
    this.workTextures = [this.createTexture(), this.createTexture()];

    for (const texture of this.workTextures) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA32F,
        this.canvas.width,
        this.canvas.height,
        0,
        this.gl.RGBA,
        this.gl.FLOAT,
        null,
      );
    }
  }

  private createTexture(): WebGLTexture {
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  private setupFramebuffers(): void {
    this.framebuffers = [
      this.gl.createFramebuffer()!,
      this.gl.createFramebuffer()!,
    ];

    for (let i = 0; i < this.framebuffers.length; i++) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[i]);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        this.workTextures[i],
        0,
      );

      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Framebuffer is not complete: " + status);
      }
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  public createSampleInitialTexture(): WebGLTexture {
    const texture = this.createTexture();
    const data = new Float32Array(
      this.canvas.width * this.canvas.height * 4,
    );

    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        const i = (y * this.canvas.width + x) * 4;
        if (Math.random() < 0.001) {
          data[i] = x;
          data[i + 1] = y;
          data[i + 2] = 1.0; // 母点マーク
        } else {
          data[i] = data[i + 1] = -1.0;
          data[i + 2] = 0.0;
        }
        data[i + 3] = 1.0;
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA32F,
      this.canvas.width,
      this.canvas.height,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      data,
    );

    return texture;
  }

  private step(
    srcTexture: WebGLTexture,
    dstFramebuffer: WebGLFramebuffer,
    level: number,
  ): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, dstFramebuffer);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.gl.useProgram(this.program);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, srcTexture);
    this.gl.uniform1i(
      this.gl.getUniformLocation(this.program, "uSampler"),
      0,
    );

    this.gl.uniform1i(this.iLevelLocation, level);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  public createInitialTextureFromImage(image: HTMLImageElement, alphaThreshold: number = 0.5, inverseAlpha: boolean): WebGLTexture {
    if (inverseAlpha) {
      alphaThreshold = 1.0 - alphaThreshold;
    }

    const texture = this.createTexture();

    const [w, h] = [this.canvas.width, this.canvas.height];
    
    // 一時的なキャンバスを作成して画像を描画
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d')!;
    
    // 画像を中央に配置（クロップまたはパディング）
    const x = (w - image.width) / 2;
    const y = (h - image.height) / 2;
    ctx.drawImage(image, x, y);
    
    // ピクセルデータを取得
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    
    // 初期テクスチャデータを作成
    const data = new Float32Array(w * h * 4);
    
    for (let y = 0; y < h ; y++) {
      for (let x = 0; x < w ; x++) {
        const i = (y * w + x) * 4;
        const j = ((h-1-y) * w + x) * 4;
        let alpha = pixels[j + 3] / 255; // アルファ値を0-1の範囲に正規化
        if (inverseAlpha) {
          alpha = 1.0 - alpha;
        }
        
        if (alpha >= alphaThreshold) {
          // アルファ値が閾値以上ならシードとして設定
          data[i] = x;
          data[i + 1] = y;
          data[i + 2] = 1.0; // 母点マーク
        } else {
          // それ以外は非シード点として設定
          data[i] = data[i + 1] = -1.0;
          data[i + 2] = 0.0;
        }
        data[i + 3] = 1.0;
      }
    }
  
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA32F,
      this.canvas.width,
      this.canvas.height,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      data
    );
  
    return texture;
  }
    
  public generate(initialTexture: WebGLTexture): WebGLTexture {
    const num = this.maxSteps;
    this.step(initialTexture, this.framebuffers[0], 0);
    for (let i = 1; i < num; i++) {
      const srcIndex = (i - 1) % 2;
      const dstIndex = i % 2;
      this.step(
        this.workTextures[srcIndex],
        this.framebuffers[dstIndex],
        i,
      );
    }

    // 結果をコピーして新しいテクスチャとして返す
    const resultTexture = this.createTexture();
    const finalWorkTexture = this.workTextures[(num - 1) % 2];

    // 一時的なフレームバッファを作成
    const tempFramebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, tempFramebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, finalWorkTexture, 0);

    // 結果を新しいテクスチャにコピー
    this.gl.bindTexture(this.gl.TEXTURE_2D, resultTexture);
    this.gl.copyTexImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, 0, 0, this.canvas.width, this.canvas.height, 0);

    // リソースのクリーンアップ
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.deleteFramebuffer(tempFramebuffer);

    return resultTexture;
  }
}
