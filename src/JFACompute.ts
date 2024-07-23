import { Computron, ComputeKit, ComputeKitConfig, UniformStructure } from './Computron';
import { FloatField } from './FloatField';

const jfaUniforms = {
  width: 'u32',
  height: 'u32',
  maxSteps: 'u32',
  currentStep: 'u32'
} as const;

const shaderCode = `
@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.y * uniforms.width + global_id.x;
    let current = input_data[index];
    let step = 1u << (uniforms.maxSteps - uniforms.currentStep);
    
    var best_distance = 3.402823466e+38;  // max float
    var best_seed = vec2f(-1.0, -1.0);

    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            let nx = i32(global_id.x) + dx * i32(step);
            let ny = i32(global_id.y) + dy * i32(step);
            let is_in_bounds = (nx >= 0 && nx < i32(uniforms.width) && ny >= 0 && ny < i32(uniforms.height));
            let neighbor_index = select(index, u32(ny) * uniforms.width + u32(nx), is_in_bounds);
            let neighbor = input_data[neighbor_index];
            
            let dx_f = f32(global_id.x) - neighbor.x;
            let dy_f = f32(global_id.y) - neighbor.y;
            let distance = dx_f * dx_f + dy_f * dy_f;
            
            let is_seed = neighbor.w == 1.0;
            let is_better = distance < best_distance && is_seed && is_in_bounds;
            best_distance = select(best_distance, distance, is_better);
            best_seed = select(best_seed, neighbor.xy, is_better);
        }
    }

    let is_current_seed = current.w == 1.0;
    let has_new_seed = best_seed.x >= 0.0;
    let new_color = select(current, vec4f(best_seed, 0.0, 1.0), has_new_seed);
    output_data[index] = select(new_color, current, is_current_seed);
}
`;

export class JFACompute {
  private computeKit: ComputeKit<typeof jfaUniforms> | null = null;
  
  constructor(private computron: Computron) {}

  async init(): Promise<void> {
    await this.createComputeKit();
  }

  private async createComputeKit(): Promise<void> {
    const config: ComputeKitConfig<typeof jfaUniforms> = {
      shaderCode,
      workgroupSize: [16, 16, 1],
      uniformsStructure: jfaUniforms
    };
    this.computeKit = this.computron.createComputeKit(config);
  }

  private generateRandomInput(width: number, height: number): FloatField {
    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.random();     // R
      data[i + 1] = Math.random(); // G
      data[i + 2] = Math.random(); // B
      data[i + 3] = Math.random(); // A
    }
    return new FloatField(width, height, data);
  }

  async compute(inputField: FloatField): Promise<FloatField> {
    if (!this.computeKit) {
      throw new Error("Compute kit not initialized.");
    }

    const maxSteps = Math.log2(Math.max(inputField.width, inputField.height)) | 0;
    console.log(`Max steps: ${maxSteps}`);

    let currentData = inputField.data;
    for (let step = 0; step < maxSteps; step++) {
      const uniforms = {
        width: inputField.width,
        height: inputField.height,
        maxSteps,
        currentStep: step
      };

      currentData = await this.computron.runCompute(
        this.computeKit,
        currentData,
        uniforms,
        inputField.width,
        inputField.height
      );

      console.log(`Step ${step} completed`);
      // ここで中間結果の分析や可視化を行うことができます
    }

    return new FloatField(inputField.width, inputField.height, currentData);
  }

  destroy() {
    // リソースの解放処理があればここに実装
  }
}
