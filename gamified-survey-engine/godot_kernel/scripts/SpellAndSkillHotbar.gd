extends Node
class_name SpellAndSkillHotbar

@export var player: CharacterBody3D
signal hotbar_activated(slot_idx: int, ability_name: String)

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed):
		return
	match event.keycode:
		KEY_1:
			cast_fireball_aoe()
		KEY_2:
			cast_frost_nova()
		KEY_3:
			trigger_lockpick_or_hack()
		KEY_4:
			drink_healing_flask()
		KEY_5:
			trigger_turn_or_telekinesis()

func cast_fireball_aoe() -> void:
	if not player or float(player.get("mana")) < 20.0:
		return
	player.set("mana", float(player.get("mana")) - 20.0)
	var target_pos = player.global_position - player.transform.basis.z * 3.0
	_spawn_vfx_burst(target_pos, Color("#ff4500"), "fire_01.png")
	emit_signal("hotbar_activated", 1, "Fireball AoE (Ignite)")
	# Trigger [Flammable] chemistry objects and damage enemies in radius
	for node in get_tree().get_nodes_in_group("interactive_props"):
		if node is Node3D and node.global_position.distance_to(player.global_position) < 6.0:
			if node.has_method("apply_elemental_stimulus"):
				node.apply_elemental_stimulus("FIRE", "player_01")
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy is Node3D and enemy.global_position.distance_to(target_pos) < 5.0:
			if enemy.has_method("apply_weapon_hit"):
				enemy.apply_weapon_hit(38.0, 40.0, "player_01")

func cast_frost_nova() -> void:
	if not player or float(player.get("mana")) < 25.0:
		return
	player.set("mana", float(player.get("mana")) - 25.0)
	_spawn_vfx_burst(player.global_position, Color("#00e5ff"), "circle_01.png")
	emit_signal("hotbar_activated", 2, "Frost Nova (Poise Shatter)")
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy is Node3D and enemy.global_position.distance_to(player.global_position) < 5.5:
			if enemy.has_method("apply_weapon_hit"):
				enemy.apply_weapon_hit(32.0, 60.0, "player_01")

func trigger_lockpick_or_hack() -> void:
	emit_signal("hotbar_activated", 3, "Stealth Lockpick / Mechanism")
	if player:
		_spawn_vfx_burst(player.global_position + Vector3(0, 1.0, 0), Color("#a855f7"), "spark_01.png")
	for node in get_tree().get_nodes_in_group("interactive_props"):
		if node is Node3D and player and node.global_position.distance_to(player.global_position) < 4.5:
			if node.has_method("apply_elemental_stimulus"):
				node.apply_elemental_stimulus("LOCKPICK", "player_01")

func drink_healing_flask() -> void:
	if not player:
		return
	var cur_hp = float(player.get("hp"))
	var m_hp = float(player.get("max_hp"))
	player.set("hp", min(m_hp, cur_hp + 55.0))
	_spawn_vfx_burst(player.global_position + Vector3(0, 1.0, 0), Color("#ffd700"), "magic_01.png")
	emit_signal("hotbar_activated", 4, "Estus / Healing Flask (+55 HP)")

func trigger_turn_or_telekinesis() -> void:
	if not player:
		return
	player.set("action_points", 4)
	player.set("stamina", float(player.get("max_stamina")))
	_spawn_vfx_burst(player.global_position + Vector3(0, 1.2, 0), Color("#38bdf8"), "star_01.png")
	emit_signal("hotbar_activated", 5, "Refresh AP / Telekinesis Pulse")

func _spawn_vfx_burst(pos: Vector3, color: Color, tex_name: String = "") -> void:
	var particles = GPUParticles3D.new()
	var mat = ParticleProcessMaterial.new()
	mat.direction = Vector3(0, 1, 0)
	mat.spread = 180.0
	mat.initial_velocity_min = 3.0
	mat.initial_velocity_max = 7.5
	mat.color = color
	particles.process_material = mat

	var quad = QuadMesh.new()
	quad.size = Vector2(0.45, 0.45)
	var std_mat = StandardMaterial3D.new()
	std_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	std_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	std_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	std_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	std_mat.albedo_color = color
	var tex_res = "res://assets/custom_asset_packs/effects_3d_2d/Kenney_Particle_Pack/" + tex_name
	if tex_name != "" and ResourceLoader.exists(tex_res):
		var loaded_tex = load(tex_res)
		if loaded_tex is Texture2D:
			std_mat.albedo_texture = loaded_tex
	quad.material = std_mat

	particles.draw_pass_1 = quad
	particles.amount = 48
	particles.lifetime = 0.55
	particles.one_shot = true
	particles.explosiveness = 0.92
	particles.global_position = pos
	if get_tree() and get_tree().current_scene:
		get_tree().current_scene.add_child(particles)
		particles.emitting = true
