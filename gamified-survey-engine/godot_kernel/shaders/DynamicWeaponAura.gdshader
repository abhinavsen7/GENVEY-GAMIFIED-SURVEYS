shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 base_albedo : source_color = vec4(0.12, 0.12, 0.15, 1.0);
uniform vec4 aura_color : source_color = vec4(1.0, 0.25, 0.05, 1.0);
uniform float emission_energy : hint_range(0.0, 16.0) = 4.5;
uniform float pulse_speed : hint_range(0.5, 10.0) = 3.2;
uniform float fresnel_power : hint_range(0.5, 8.0) = 2.5;

void vertex() {
	// Subtle high-frequency elemental vibration along blade tip
	if (VERTEX.z > 0.3) {
		VERTEX.x += sin(TIME * 25.0 + VERTEX.z * 10.0) * 0.004;
	}
}

void fragment() {
	ALBEDO = base_albedo.rgb;
	METALLIC = 0.85;
	ROUGHNESS = 0.22;

	// Fresnel edge glow + scrolling energy veins
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), fresnel_power);
	float wave = sin(VERTEX.y * 12.0 - TIME * pulse_speed) * 0.5 + 0.5;
	EMISSION = aura_color.rgb * (fresnel * emission_energy + wave * 0.35 * emission_energy);
}
