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

interface Destroyable {
  destroy(): void;
}

export class ResourceScope {
  private resources: Set<Destroyable> = new Set();

  track<T extends Destroyable>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }

  release() {
    for (const resource of this.resources) {
      resource.destroy();
    }
    this.resources.clear();
  }

  [Symbol.dispose](): void {
    this.release();
  }
}

export class ComputeKit<T extends UniformStructure<any>> implements Destroyable {
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

  destroy(): void {
    // GPUComputePipeline doesn't have a destroy method, so we don't need to do anything here.
    // If there are any resources that need to be cleaned up in the future, they should be handled here.
  }
}

export class Computron {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private currentScope: ResourceScope | null = null;

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

  createResourceScope(): ResourceScope {
    const scope = new ResourceScope();
    this.currentScope = scope;
    return scope;
  }

  endResourceScope(scope: ResourceScope) {
    if (this.currentScope === scope) {
      this.currentScope = null;
    }
  }

  private trackResource<T extends Destroyable>(resource: T): T {
    if (this.currentScope) {
      return this.currentScope.track(resource);
    }
    return resource;
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

    return this.trackResource(new ComputeKit(pipeline, bindGroupLayout, config.workgroupSize, config.uniformsStructure));
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

    const inputBuffer = this.createStorageBuffer(inputData);
    const uniformBuffer = this.createUniformBuffer(this.uniformsToFloat32Array(uniforms, computeKit.uniformsStructure));
    const bindGroup = this.createBindGroup(computeKit.bindGroupLayout, [inputBuffer, uniformBuffer]);

    const workgroupCount = computeKit.calculateWorkgroups(width, height);

    const commandEncoder = this.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computeKit.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(...workgroupCount);
    passEncoder.end();

    const stagingBuffer = this.device.createBuffer({
      size: dataSize * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    commandEncoder.copyBufferToBuffer(
      inputBuffer,
      0,
      stagingBuffer,
      0,
      dataSize * Float32Array.BYTES_PER_ELEMENT
    );

    this.device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const resultArray = new Float32Array(stagingBuffer.getMappedRange());
    const resultCopy = resultArray.slice();

    stagingBuffer.unmap();

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
    return this.trackResource(
      this.createBuffer(data, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST)
    );
  }

  private createUniformBuffer(data: Float32Array): GPUBuffer {
    return this.trackResource(
      this.createBuffer(data, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    );
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