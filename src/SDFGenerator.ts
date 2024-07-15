import { NearestSeedFieldGenerator } from './NearestSeedFieldGenerator';

export class SDFGenerator {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private framebuffer: WebGLFramebuffer;

  constructor(private nsfGenerator: NearestSeedFieldGenerator) {
    this.gl = (this.nsfGenerator as any).gl;
    this.initWebGL();
  }

  private initWebGL(): void {
    const vertexShaderSource = `#version 300 es
      in vec4 aVertexPosition;
      void main() {
        gl_Position = aVertexPosition;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;
      uniform sampler2D uSamplerA;
      uniform sampler2D uSamplerB;
      uniform float uMaxDist;
      uniform vec2 uTextureSize;
      out vec4 fragColor;

      void main() {
        vec2 currentPos = gl_FragCoord.xy;
        vec2 texCoord = currentPos / uTextureSize;
        vec4 dataA = texture(uSamplerA, texCoord);
        vec4 dataB = texture(uSamplerB, texCoord);
        
        float alpha;
        
        if (0.0 < dataA.z) {
          // 内側の場合
          vec2 seedPosB = dataB.xy;
          float distB = length(seedPosB - currentPos);
          float normalizedDistB = distB / uMaxDist;
          alpha = 0.5 + (normalizedDistB * 0.5); // 0.5 to 1.0
          alpha = clamp(alpha, 0.0, 1.0);
          // alpha = clamp(normalizedDistB, 0.0, 1.0);
          fragColor = vec4(1.0, 1.0, 1.0, alpha);
        } else {
          // 外側の場合
          vec2 seedPosA = dataA.xy;
          float distA = length(seedPosA - currentPos);
          float normalizedDistA = distA / uMaxDist;
          alpha = 0.5 - (normalizedDistA * 0.5); // 0.0 to 0.5
          alpha = clamp(alpha, 0.0, 1.0);
          // alpha = clamp(normalizedDistA, 0.0, 1.0);
          fragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      }
      `;

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    this.program = this.gl.createProgram()!;
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(this.program));
    }

    this.gl.useProgram(this.program);

    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    const positionAttributeLocation = this.gl.getAttribLocation(this.program, "aVertexPosition");
    this.gl.enableVertexAttribArray(positionAttributeLocation);
    this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  public generate(nsfTextureA: WebGLTexture, nsfTextureB: WebGLTexture, maxDist: number, alphaThreshold: number | null): HTMLImageElement {
    const canvas = (this.nsfGenerator as any).canvas;
    
    // 出力用テクスチャとフレームバッファの設定
    this.texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, canvas.width, canvas.height, 0, this.gl.RGBA, this.gl.FLOAT, null);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    this.framebuffer = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texture, 0);

    // SDFの生成
    this.gl.viewport(0, 0, canvas.width, canvas.height);

    this.gl.useProgram(this.program);
    
    // 入力テクスチャのバインド
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, nsfTextureA);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, nsfTextureB);
    
    // ユニフォーム変数の設定
    const samplerALocation = this.gl.getUniformLocation(this.program, "uSamplerA");
    const samplerBLocation = this.gl.getUniformLocation(this.program, "uSamplerB");
    const maxDistLocation = this.gl.getUniformLocation(this.program, "uMaxDist");
    const textureSizeLocation = this.gl.getUniformLocation(this.program, "uTextureSize");
    
    this.gl.uniform1i(samplerALocation, 0);
    this.gl.uniform1i(samplerBLocation, 1);
    this.gl.uniform1f(maxDistLocation, maxDist);
    this.gl.uniform2f(textureSizeLocation, canvas.width, canvas.height);

    // 描画
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    // 結果を新しいImageElementにコピー
    const resultImg = new Image();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d')!;
    
    // フレームバッファから結果を読み取り
    const pixels = new Float32Array(canvas.width * canvas.height * 4);
    this.gl.readPixels(0, 0, canvas.width, canvas.height, this.gl.RGBA, this.gl.FLOAT, pixels);

    // ピクセルデータを正しい向きで描画
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const sourceIndex = ((canvas.height - 1 - y) * canvas.width + x) * 4;
        const targetIndex = (y * canvas.width + x) * 4;
        // alphaThresholdがある場合、アルファ値がそれ以上だったら255にする
        let rawAlpha = pixels[sourceIndex + 3];
        if (alphaThreshold != null) {
          rawAlpha = rawAlpha < alphaThreshold ? 0 : 1;
        }
        // アルファ値を 0-255 の範囲に変換
        const alpha = Math.round(rawAlpha * 255);
        imageData.data[targetIndex] = Math.round(pixels[sourceIndex] * 255);
        imageData.data[targetIndex + 1] = Math.round(pixels[sourceIndex + 1] * 255);
        imageData.data[targetIndex + 2] = Math.round(pixels[sourceIndex + 2] * 255);
        imageData.data[targetIndex + 3] = alpha;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    resultImg.src = tempCanvas.toDataURL();

    // WebGLの状態をリセット
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    return resultImg;
  }
}
