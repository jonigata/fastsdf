import { Computron, ComputeKit, ComputeKitConfig } from './Computron';
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
    let step = 1u << (uniforms.maxSteps - 1 - uniforms.currentStep);
    
    var best_distance = current.w;
    var best_seed = current.xy;

    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            let nx = i32(global_id.x) + dx * i32(step);
            let ny = i32(global_id.y) + dy * i32(step);
            let is_in_bounds = (nx >= 0 && nx < i32(uniforms.width) && ny >= 0 && ny < i32(uniforms.height));
            let neighbor_index = select(index, u32(ny) * uniforms.width + u32(nx), is_in_bounds);
            let neighbor = input_data[neighbor_index];
            
            let is_processed = neighbor.x >= 0.0;  // 1回以上処理済みかどうか
            let dx_f = f32(global_id.x) - neighbor.x;
            let dy_f = f32(global_id.y) - neighbor.y;
            let distance = dx_f * dx_f + dy_f * dy_f;
            
            let is_better = distance < best_distance && is_processed && is_in_bounds;
            best_distance = select(best_distance, distance, is_better);
            best_seed = select(best_seed, neighbor.xy, is_better);
        }
    }

    output_data[index] = vec4f(best_seed, current.z, best_distance);
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

  async compute(inputField: FloatField): Promise<FloatField> {
    if (!this.computeKit) {
      throw new Error("Compute kit not initialized.");
    }

    const maxSteps = Math.log2(Math.max(inputField.width, inputField.height)) | 0;

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
    }

    return new FloatField(inputField.width, inputField.height, currentData);
  }

  destroy() {
    // リソースの解放処理があればここに実装
  }


  static createJFASeedMap(field: FloatField, alphaThreshold: number, inverseAlpha: boolean): FloatField {
    const newField = new FloatField(field.width, field.height);
    const inputData = field.data;
    const outputData = newField.data;
    const [w, h] = [field.width, field.height];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let alpha = inputData[i + 3];
        if (inverseAlpha) {
          alpha = 1.0 - alpha;
        }
        
        if (alpha >= alphaThreshold) {
          // アルファ値が閾値以上ならシードとして設定
          outputData[i + 0] = x;
          outputData[i + 1] = y;
          outputData[i + 2] = 1.0; // 母点マーク
          outputData[i + 3] = 0.0;
        } else {
          // それ以外は非シード点として設定
          outputData[i + 0] = -1.0;
          outputData[i + 1] = -1.0;
          outputData[i + 2] = 0.0;
          outputData[i + 3] = 1e38;
        }
      }
    }
    
    return newField;
  }

  static generateDistanceField(field: FloatField, maxDist: number, alphaThreshold: number | null = null): FloatField {
    const newField = new FloatField(field.width, field.height);
    const inputData = field.data;
    const outputData = newField.data;
    const [w, h] = [field.width, field.height];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // alphaThresholdがある場合適用
        let alpha = inputData[i + 3];
        const dist = Math.sqrt(inputData[i + 3]);
        const normalizedDist = dist / maxDist;
        alpha = 1.0 - normalizedDist; // 0.0 to 1.0
        if (alphaThreshold != null) {
          alpha = alpha < alphaThreshold ? 0 : 1;
        } else {
          alpha = Math.max(0, Math.min(1, alpha));
        }
        outputData[i + 0] = 1.0;
        outputData[i + 1] = 1.0;
        outputData[i + 2] = 1.0;
        outputData[i + 3] = alpha;
      }
    }

    return newField;
  }

  static generateSignedDistanceField(
    outerField: FloatField,
    innerField: FloatField,
    maxDist: number,
    alphaThreshold?: number
  ): FloatField {
    const dstField = new FloatField(outerField.width, outerField.height);
    const dstData = dstField.data;
    const outerData = outerField.data;
    const innerData = innerField.data;
    const [w, h] = [outerField.width, outerField.height];
  
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let alpha;
        const outerDistSq = outerData[i + 3];
        if (outerDistSq === 0) {
          const innerDistSq = innerData[i + 3];
          alpha = Math.min(1.0, 0.5 + Math.sqrt(innerDistSq) / maxDist);
        } else {
          alpha = Math.max(0.0, 0.5 - Math.sqrt(outerDistSq) / maxDist);
        }
        if (alphaThreshold != null) {
          alpha = alpha < alphaThreshold ? 0 : 1;
        }
        dstData[i + 0] = 1.0;
        dstData[i + 1] = 1.0;
        dstData[i + 2] = 1.0;
        dstData[i + 3] = alpha;
      }
    }
  
    return dstField;
  }
}
