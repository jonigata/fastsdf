export const jfaShaderCode = `
@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, WORKGROUP_SIZE_Z)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.y * uniforms.width + global_id.x;
    if (index >= uniforms.width * uniforms.height) {
        return;
    }
    
    // すべてのピクセルを赤色に設定 (R=1, G=0, B=0, A=1)
    output_data[index] = vec4f(1.0, 0.0, 0.0, 1.0);
}
        `;