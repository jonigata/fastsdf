// Computron.ts

export type UniformFormat = 'u32' | 'i32' | 'f32';

export type UniformStructure<T> = {
  [K in keyof T]: UniformFormat;
};

export type UniformValues<T extends UniformStructure<any>> = {
  [K in keyof T]: number;
};

export interface ComputeKitConfig<T extends UniformStructure<any>> {
  shaderCode: string;
  workgroupSize: [number, number, number];
  uniformsStructure: T;
}

export class ComputeKit<T extends UniformStructure<any>> {
  constructor(
    public pipeline: GPUComputePipeline,
    public bindGroupLayout: GPUBindGroupLayout,
    public workgroupSize: [number, number, number],
    public uniformsStructure: T
  ) {}

  calculateWorkgroups(width: number, height: number): [number, number, number] {
    return [
      Math.ceil(width / this.workgroupSize[0]),
      Math.ceil(height / this.workgroupSize[1]),
      1
    ];
  }
}

export class Computron {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported on this browser.");
    }

    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error("No appropriate GPUAdapter found.");
    }

    await this.initializeDevice();
  }

  private async initializeDevice(): Promise<void> {
    if (!this.adapter) {
      throw new Error("GPUAdapter not initialized.");
    }

    this.device = await this.adapter.requestDevice();
    
    this.device.lost.then((info) => {
      console.warn(`WebGPU device was lost: ${info.message}`);
      this.device = null;
      
      this.initializeDevice().then(() => {
      // console.log("WebGPU device successfully restored.");
      }).catch(error => {
        console.error("Failed to restore WebGPU device:", error);
      });
    });

    this.device.onuncapturederror = (event: GPUUncapturedErrorEvent) => {
      console.error("Uncaptured WebGPU error:", event.error);
    };
  }

  createComputeKit<T extends UniformStructure<any>>(config: ComputeKitConfig<T>): ComputeKit<T> {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }

    const uniformsStructCode = this.generateUniformsStructCode(
      config.uniformsStructure,
      'ComputeUniforms',
      config.workgroupSize
    );

    const fullShaderCode = `
${uniformsStructCode}

${config.shaderCode}
`;

    const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    ];

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: bindGroupLayoutEntries
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    const shaderModule = this.device.createShaderModule({ code: fullShaderCode });

    const pipeline = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: "main"
      }
    });

    return new ComputeKit(pipeline, bindGroupLayout, config.workgroupSize, config.uniformsStructure);
  }

  async runCompute<T extends UniformStructure<any>>(
    computeKit: ComputeKit<T>,
    inputData: Float32Array,
    uniforms: UniformValues<T>,
    width: number,
    height: number
  ): Promise<Float32Array> {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }

    const dataSize = width * height * 4;
    if (inputData.length !== dataSize) {
      throw new Error(`Invalid input data length. Expected ${dataSize}, but got ${inputData.length}`);
    }

    // console.log(`Input data size: ${inputData.length}`);

    const inputBuffer = this.createStorageBuffer(inputData);
    // console.log(`Input buffer size: ${inputBuffer.size}`);

    const uniformBuffer = this.createUniformBuffer(this.uniformsToFloat32Array(uniforms, computeKit.uniformsStructure));
    // console.log(`Uniform buffer size: ${uniformBuffer.size}`);

    const bindGroup = this.createBindGroup(computeKit.bindGroupLayout, [inputBuffer, uniformBuffer]);

    const workgroupCount = computeKit.calculateWorkgroups(width, height);
    // console.log(`Workgroup count: ${workgroupCount}`);

    const commandEncoder = this.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computeKit.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(...workgroupCount);
    passEncoder.end();

    // Create a staging buffer for reading back the result
    const stagingBuffer = this.device.createBuffer({
      size: dataSize * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Copy the result from the storage buffer to the staging buffer
    commandEncoder.copyBufferToBuffer(
      inputBuffer,
      0,
      stagingBuffer,
      0,
      dataSize * Float32Array.BYTES_PER_ELEMENT
    );

    this.device.queue.submit([commandEncoder.finish()]);

    // Map the staging buffer to read the results
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const resultArray = new Float32Array(stagingBuffer.getMappedRange());
    // console.log(`Result array length: ${resultArray.length}`);

    // Create a copy of the result before unmapping
    const resultCopy = resultArray.slice();

    stagingBuffer.unmap();

    // Clean up
    inputBuffer.destroy();
    uniformBuffer.destroy();
    stagingBuffer.destroy();

    return resultCopy;
  }

  private uniformsToFloat32Array<T extends UniformStructure<any>>(
    uniforms: UniformValues<T>,
    structure: T
  ): Float32Array {
    const result: number[] = [];
    for (const [key, type] of Object.entries(structure)) {
      const value = uniforms[key as keyof T];
      if (type === 'f32') {
        result.push(value);
      } else {
        result.push(Math.floor(value));  // u32 and i32 should be integers
      }
    }
    return new Float32Array(result);
  }

  private createStorageBuffer(data: Float32Array): GPUBuffer {
    const buffer = this.createBuffer(data, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    // console.log(`Created storage buffer with size: ${buffer.size}`);
    return buffer;
  }

  private createUniformBuffer(data: Float32Array): GPUBuffer {
    const buffer = this.createBuffer(data, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    // console.log(`Created uniform buffer with size: ${buffer.size}`);
    return buffer;
  }

  private createBuffer(data: Float32Array, usage: GPUBufferUsageFlags): GPUBuffer {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }

  private async readBuffer(buffer: GPUBuffer, size: number): Promise<Float32Array> {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }
    const readBuffer = this.device.createBuffer({
      size: size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, size);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const resultArray = new Float32Array(readBuffer.getMappedRange());
    readBuffer.unmap();
    return resultArray;
  }

  private createBindGroup(layout: GPUBindGroupLayout, buffers: GPUBuffer[]): GPUBindGroup {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }
    const entries = buffers.map((buffer, index) => ({
      binding: index,
      resource: { buffer }
    }));
    return this.device.createBindGroup({ layout, entries });
  }

  private createCommandEncoder(): GPUCommandEncoder {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }
    return this.device.createCommandEncoder();
  }

  private submitCommandBuffer(commandBuffer: GPUCommandBuffer): void {
    if (!this.device) {
      throw new Error("GPUDevice not initialized.");
    }
    this.device.queue.submit([commandBuffer]);
  }

  private generateUniformsStructCode<T extends UniformStructure<any>>(
    uniformsStructure: T,
    structName: string,
    workgroupSize: [number, number, number]
  ): string {
    const uniformFields = Object.entries(uniformsStructure)
      .map(([key, type]) => `    ${key}: ${type},`)
      .join('\n');

    return `
const WORKGROUP_SIZE_X = ${workgroupSize[0]}u;
const WORKGROUP_SIZE_Y = ${workgroupSize[1]}u;
const WORKGROUP_SIZE_Z = ${workgroupSize[2]}u;

struct ${structName} {
${uniformFields}
};

@group(0) @binding(0) var<storage, read_write> data: array<vec4f>;
@group(0) @binding(1) var<uniform> uniforms: ${structName};
`;
  }

  destroy() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}