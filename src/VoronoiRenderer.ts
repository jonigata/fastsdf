import { NearestSeedFieldGenerator } from './NearestSeedFieldGenerator';

export class VoronoiRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;

  constructor(private fieldGenerator: NearestSeedFieldGenerator) {
    this.gl = this.fieldGenerator['gl'] as WebGL2RenderingContext; // private フィールドにアクセス
    this.initWebGL();
  }

  private initWebGL(): void {
    const canvas = this.fieldGenerator['canvas'] as HTMLCanvasElement; // private フィールドにアクセス
    this.gl.viewport(0, 0, canvas.width, canvas.height);

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, `#version 300 es
      in vec4 aVertexPosition;
      void main() {
        gl_Position = aVertexPosition;
      }
    `);

    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform sampler2D uSampler;
      out vec4 fragColor;

      // 簡単なハッシュ関数
      vec3 hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yxz+33.33);
        return fract((p3.xxy+p3.yzz)*p3.zyx);
      }

      void main()
      {
        vec2 fc = gl_FragCoord.xy;
        vec4 pixel = texelFetch(uSampler, ivec2(fc), 0);
        
        // SDFの値（ここではxy座標）を使ってハッシュ色を生成
        vec3 color = hash(pixel.xy);
        
        // 母点は白で表示
        if (pixel.z == 1.0) {
          color = vec3(1.0);
        }
        
        fragColor = vec4(color, 1.0);
      }
    `);

    this.program = this.gl.createProgram()!;
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    this.setupBuffers();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error("An error occurred compiling the shaders: " + this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  private setupBuffers(): void {
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    const positionAttributeLocation = this.gl.getAttribLocation(this.program, "aVertexPosition");
    this.gl.enableVertexAttribArray(positionAttributeLocation);
    this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  public render(fieldTexture: WebGLTexture): void {
    const canvas = this.fieldGenerator['canvas'] as HTMLCanvasElement; // private フィールドにアクセス
    this.gl.viewport(0, 0, canvas.width, canvas.height);
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);
    
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, fieldTexture);
    
    const samplerLocation = this.gl.getUniformLocation(this.program, "uSampler");
    this.gl.uniform1i(samplerLocation, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}