extends CharacterBody3D
class_name UniversalPlayer

enum GameMode { CRPG_ISOMETRIC, SOULSLIKE_ACTION, IMMERSIVE_SIM }
@export var current_mode: GameMode = GameMode.SOULSLIKE_ACTION

# Combat & Movement Stats
@export var move_speed: float = 5.5
@export var roll_speed: float = 10.0
@export var max_stamina: float = 100.0
var stamina: float = 100.0
var is_rolling: bool = false
var is_invincible: bool = false
var is_attacking: bool = false

# Dynamic References
@onready var nav_agent: NavigationAgent3D = get_node_or_null("NavigationAgent3D")
@onready var spring_arm: SpringArm3D = get_node_or_null("SpringArm3D")
@onready var iso_camera: Camera3D = get_node_or_null("IsoCamera3D")
@onready var action_camera: Camera3D = get_node_or_null("SpringArm3D/ActionCamera3D")
@onready var right_hand_socket: Node3D = get_node_or_null("Rig/Skeleton3D/RightHandSocket")
@onready var anim_player: AnimationPlayer = get_node_or_null("AnimationPlayer")

func _ready() -> void:
	add_to_group("player")
	apply_camera_mode(current_mode)

func apply_camera_mode(mode: GameMode) -> void:
	current_mode = mode
	if mode == GameMode.CRPG_ISOMETRIC:
		if iso_camera: iso_camera.current = true
		if action_camera: action_camera.current = false
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		if iso_camera: iso_camera.current = false
		if action_camera: action_camera.current = true
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_mode"):
		var next_mode = GameMode.CRPG_ISOMETRIC if current_mode != GameMode.CRPG_ISOMETRIC else GameMode.SOULSLIKE_ACTION
		apply_camera_mode(next_mode)

	if current_mode == GameMode.CRPG_ISOMETRIC:
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			if iso_camera:
				var mouse_pos = get_viewport().get_mouse_position()
				var from = iso_camera.project_ray_origin(mouse_pos)
				var to = from + iso_camera.project_ray_normal(mouse_pos) * 100.0
				var space = get_world_3d().direct_space_state
				var query = PhysicsRayQueryParameters3D.create(from, to)
				var hit = space.intersect_ray(query)
				if hit and nav_agent:
					nav_agent.target_position = hit.position
	else:
		if event is InputEventMouseMotion:
			rotate_y(-event.relative.x * 0.003)
			if spring_arm:
				spring_arm.rotate_x(clamp(spring_arm.rotation.x - event.relative.y * 0.003, -1.2, 0.6))
		if event.is_action_pressed("dodge_roll") and stamina >= 25.0 and not is_rolling:
			perform_dodge_roll()
		if event.is_action_pressed("attack") and stamina >= 18.0 and not is_attacking:
			perform_weapon_attack()

func _physics_process(delta: float) -> void:
	stamina = min(max_stamina, stamina + 14.0 * delta)
	if not is_on_floor():
		velocity.y -= 9.8 * delta

	if current_mode == GameMode.CRPG_ISOMETRIC:
		if nav_agent and not nav_agent.is_navigation_finished():
			var next_pos = nav_agent.get_next_path_position()
			var dir = (next_pos - global_position).normalized()
			velocity.x = dir.x * move_speed
			velocity.z = dir.z * move_speed
			if dir.length_squared() > 0.001:
				look_at(global_position + Vector3(dir.x, 0, dir.z), Vector3.UP)
		else:
			velocity.x = 0.0
			velocity.z = 0.0
	else:
		if not is_rolling:
			var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
			var direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
			velocity.x = direction.x * move_speed
			velocity.z = direction.z * move_speed

	move_and_slide()

func perform_dodge_roll() -> void:
	stamina -= 25.0
	is_rolling = true
	is_invincible = true
	var forward = -transform.basis.z.normalized()
	velocity.x = forward.x * roll_speed
	velocity.z = forward.z * roll_speed
	await get_tree().create_timer(0.35).timeout
	is_invincible = false
	await get_tree().create_timer(0.15).timeout
	is_rolling = false

func perform_weapon_attack(hitstop_ms: int = 70) -> void:
	stamina -= 18.0
	is_attacking = true
	if anim_player and anim_player.has_animation("CustomSlash"):
		anim_player.play("CustomSlash")
	
	# Windup phase (0.0 -> 0.32)
	await get_tree().create_timer(0.2).timeout
	
	# Active Hitbox window (0.32 -> 0.58): check enemies in front
	var hit_enemy: SurveyBossAI = null
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy is SurveyBossAI and global_position.distance_to(enemy.global_position) < 3.0:
			hit_enemy = enemy
			break

	if hit_enemy:
		# Soulslike Hitstop frame freeze on impact
		Engine.time_scale = 0.05
		hit_enemy.apply_weapon_hit(35.0, 25.0, "Player_1")
		await get_tree().create_timer((hitstop_ms / 1000.0) * 0.05).timeout
		Engine.time_scale = 1.0
	else:
		await get_tree().create_timer(0.15).timeout

	# Recovery phase (0.58 -> 1.0)
	await get_tree().create_timer(0.2).timeout
	is_attacking = false

func equip_runtime_glb_weapon(glb_bytes: PackedByteArray, hex_color: String) -> void:
	var gltf_doc = GLTFDocument.new()
	var gltf_state = GLTFState.new()
	if gltf_doc.append_from_buffer(glb_bytes, "", gltf_state) == OK:
		var weapon_node = gltf_doc.generate_scene(gltf_state)
		
		# Create DynamicWeaponAura shader material
		var aura_shader = load("res://shaders/DynamicWeaponAura.gdshader") as Shader
		if aura_shader:
			var mat = ShaderMaterial.new()
			mat.shader = aura_shader
			mat.set_shader_parameter("aura_color", Color(hex_color))
			mat.set_shader_parameter("emission_energy", 4.5)
			_apply_material_recursive(weapon_node, mat)

		if right_hand_socket:
			for child in right_hand_socket.get_children():
				child.queue_free()
			right_hand_socket.add_child(weapon_node)
		else:
			print("[UniversalPlayer] Weapon equipped (bytes loaded: ", glb_bytes.size(), ", color: ", hex_color, ")")

func _apply_material_recursive(node: Node, mat: Material) -> void:
	if node is MeshInstance3D:
		node.material_override = mat
	for child in node.get_children():
		_apply_material_recursive(child, mat)

