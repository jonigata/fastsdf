// JFACompute.ts

import { Computron, ComputeKit, ComputeKitConfig, UniformStructure } from './Computron';
import { jfaShaderCode } from './JFAShader';

const jfaUniforms = {
  width: 'u32',
  height: 'u32',
  maxSteps: 'u32',
  currentStep: 'u32'
} as const;

export class JFACompute {
  private computeKit: ComputeKit<typeof jfaUniforms> | null = null;

  constructor(private computron: Computron) {
  }

  async init(): Promise<void> {
    await this.createComputeKit();
  }

  private async createComputeKit(): Promise<void> {
    const config: ComputeKitConfig<typeof jfaUniforms> = {
      shaderCode: jfaShaderCode,
      workgroupSize: [16, 16, 1],
      uniformsStructure: jfaUniforms
    };

    this.computeKit = this.computron.createComputeKit(config);
  }

  async compute(inputData: Float32Array, width: number, height: number): Promise<Float32Array> {
    if (!this.computeKit) {
      throw new Error("Compute kit not initialized.");
    }

    const maxSteps = Math.log2(Math.max(width, height)) | 0;
    let currentData = inputData;

    for (let step = 0; step < maxSteps; step++) {
      const uniforms = {
        width,
        height,
        maxSteps,
        currentStep: step
      };

      console.log(currentData.buffer.byteLength);
      currentData = await this.computron.runCompute(
        this.computeKit,
        currentData,
        uniforms,
        width,
        height
      );
    }

    return currentData;
  }

  destroy() {
    this.computron.destroy();
  }
}