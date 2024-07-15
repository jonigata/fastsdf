import { NearestSeedFieldGenerator } from './NearestSeedFieldGenerator';

export class DFGenerator {
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
      uniform sampler2D uSampler;
      uniform float uMaxDist;
      uniform vec2 uTextureSize;
      out vec4 fragColor;

      void main() {
        vec2 texCoord = gl_FragCoord.xy / uTextureSize;
        vec4 seedData = texture(uSampler, texCoord);
        vec2 seedPos = seedData.xy;
        vec2 currentPos = gl_FragCoord.xy;
        float dist = length(seedPos - currentPos);
        float normalizedDist = dist / uMaxDist;
        float alpha = 1.0 - clamp(normalizedDist, 0.0, 1.0);
        fragColor = vec4(1.0, 1.0, 1.0, alpha);  // 黒背景に変更
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

  public generate(nsfTexture: WebGLTexture, maxDist: number): HTMLImageElement {
    const canvas = (this.nsfGenerator as any).canvas;
    
    // 出力用テクスチャとフレームバッファの設定
    this.texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, canvas.width, canvas.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    this.framebuffer = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texture, 0);

    // フレームバッファのクリア
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // SDFの生成
    this.gl.viewport(0, 0, canvas.width, canvas.height);

    this.gl.useProgram(this.program);
    
    // 入力テクスチャのバインド
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, nsfTexture);
    
    // ユニフォーム変数の設定
    const samplerLocation = this.gl.getUniformLocation(this.program, "uSampler");
    const maxDistLocation = this.gl.getUniformLocation(this.program, "uMaxDist");
    const textureSizeLocation = this.gl.getUniformLocation(this.program, "uTextureSize");
    
    this.gl.uniform1i(samplerLocation, 0);
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
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    this.gl.readPixels(0, 0, canvas.width, canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    // ピクセルデータを正しい向きで描画
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const sourceIndex = ((canvas.height - 1 - y) * canvas.width + x) * 4;
        const targetIndex = (y * canvas.width + x) * 4;
        imageData.data[targetIndex] = pixels[sourceIndex];
        imageData.data[targetIndex + 1] = pixels[sourceIndex + 1];
        imageData.data[targetIndex + 2] = pixels[sourceIndex + 2];
        imageData.data[targetIndex + 3] = pixels[sourceIndex + 3];
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
