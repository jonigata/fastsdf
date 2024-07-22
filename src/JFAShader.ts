export const jfaShaderCode = `
@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, WORKGROUP_SIZE_Z)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.y * uniforms.width + global_id.x;
    if (index >= uniforms.width * uniforms.height) {
        return;
    }

    let current = data[index];
    if (current.z == 1.0) {
        return;  // This is a seed point, no need to update
    }

    let step = 1u << (uniforms.maxSteps - uniforms.currentStep);
    var best_distance = 3.402823466e+38;  // max float
    var best_seed = vec2f(-1.0, -1.0);

    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            let nx = i32(global_id.x) + dx * i32(step);
            let ny = i32(global_id.y) + dy * i32(step);

            if (nx >= 0 && nx < i32(uniforms.width) && ny >= 0 && ny < i32(uniforms.height)) {
                let neighbor_index = u32(ny) * uniforms.width + u32(nx);
                let neighbor = data[neighbor_index];

                if (neighbor.z == 1.0) {
                    let dx = f32(global_id.x) - neighbor.x;
                    let dy = f32(global_id.y) - neighbor.y;
                    let distance = dx * dx + dy * dy;

                    if (distance < best_distance) {
                        best_distance = distance;
                        best_seed = neighbor.xy;
                    }
                }
            }
        }
    }

    if (best_seed.x >= 0.0) {
        data[index] = vec4f(best_seed, 0.0, 1.0);
    }
}
`;