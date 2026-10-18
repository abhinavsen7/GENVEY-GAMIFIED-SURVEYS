extends CharacterBody3D
class_name MasterCombatController

enum GenreStyle { BALDURS_GATE_CRPG, DARK_SOULS_ACTION, ULTIMA_IMMERSIVE_SANDBOX }
enum CombatState { IDLE, MOVE, ATTACK_1, ATTACK_2, ATTACK_HEAVY, DODGE_ROLL, PARRY, CASTING, STAGGERED }

@export var active_genre: GenreStyle = GenreStyle.DARK_SOULS_ACTION
@export var max_hp: float = 150.0
@export var max_stamina: float = 100.0
@export var max_mana: float = 80.0
@export var base_walk_speed: float = 5.8
@export var dodge_impulse: float = 11.5

var hp: float = 150.0
var stamina: float = 100.0
var mana: float = 80.0
var action_points: int = 4 # Used in BALDURS_GATE_CRPG turn-based mode
var state: CombatState = CombatState.IDLE
var combo_queued: bool = false
var is_invincible: bool = false
var is_parrying: bool = false
var riposte_ready_timer: float = 0.0
var equipped_weapon_bonus: float = 0.0
var equipped_weapon_name: String = "Starter Blade"

# Dynamic Nodes
var skeleton: Skeleton3D = null
var anim_player: AnimationPlayer = null
var weapon_socket: BoneAttachment3D = null
var weapon_hitbox: Area3D = null
var locked_target: Node3D = null

var spring_arm: SpringArm3D = null
var action_cam: Camera3D = null
var iso_cam: Camera3D = null
var nav_agent: NavigationAgent3D = null

# Resolved Animation Clip Map
var resolved_anims: Dictionary = {
	"idle": "",
	"walk": "",
	"run": "",
	"attack_1": "",
	"attack_2": "",
	"attack_heavy": "",
	"dodge": "",
	"parry": "",
	"hit": "",
	"death": ""
}

signal stats_updated(hp: float, stamina: float, mana: float, ap: int)
signal weapon_equipped_signal(weapon_data: Dictionary)
signal combat_banner_signal(msg: String)

func _ready() -> void:
	_ensure_camera_and_nav_nodes()
	_bind_character_rig_and_animations(self)
	_setup_weapon_hitbox()
	set_genre_style(active_genre)

func _ensure_camera_and_nav_nodes() -> void:
	spring_arm = get_node_or_null("SpringArm3D") as SpringArm3D
	if not spring_arm:
		spring_arm = SpringArm3D.new()
		spring_arm.name = "SpringArm3D"
		spring_arm.position = Vector3(0, 1.65, 0)
		spring_arm.spring_length = 4.8
		spring_arm.rotation_degrees = Vector3(-18, 0, 0)
		add_child(spring_arm)

	action_cam = spring_arm.get_node_or_null("ActionCamera3D") as Camera3D
	if not action_cam:
		action_cam = Camera3D.new()
		action_cam.name = "ActionCamera3D"
		spring_arm.add_child(action_cam)

	iso_cam = get_node_or_null("IsoCamera3D") as Camera3D
	if not iso_cam:
		iso_cam = Camera3D.new()
		iso_cam.name = "IsoCamera3D"
		iso_cam.position = Vector3(0, 13.5, 11.0)
		iso_cam.rotation_degrees = Vector3(-48, 0, 0)
		add_child(iso_cam)

	nav_agent = get_node_or_null("NavigationAgent3D") as NavigationAgent3D
	if not nav_agent:
		nav_agent = NavigationAgent3D.new()
		nav_agent.name = "NavigationAgent3D"
		nav_agent.path_desired_distance = 0.6
		nav_agent.target_desired_distance = 0.8
		add_child(nav_agent)

func set_genre_style(style: GenreStyle) -> void:
	active_genre = style
	_ensure_camera_and_nav_nodes()
	if style == GenreStyle.BALDURS_GATE_CRPG or style == GenreStyle.ULTIMA_IMMERSIVE_SANDBOX:
		iso_cam.current = true
		action_cam.current = false
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		iso_cam.current = false
		action_cam.current = true
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func bind_character_model(rig_node: Node) -> void:
	_bind_character_rig_and_animations(rig_node)

func _bind_character_rig_and_animations(root_node: Node) -> void:
	skeleton = _find_node_of_type(root_node, "Skeleton3D") as Skeleton3D
	anim_player = _find_node_of_type(root_node, "AnimationPlayer") as AnimationPlayer

	if skeleton:
		if weapon_socket and is_instance_valid(weapon_socket):
			weapon_socket.queue_free()
		weapon_socket = BoneAttachment3D.new()
		weapon_socket.name = "RightHandWeaponSocket"
		var candidate_bones = ["handslot.r", "RightHand", "mixamorig:RightHand", "hand.R", "hand_r", "Hand_R", "weapon_r"]
		for b_name in candidate_bones:
			var idx = skeleton.find_bone(b_name)
			if idx != -1:
				weapon_socket.bone_name = b_name
				break
		skeleton.add_child(weapon_socket)

	if anim_player:
		var clips = anim_player.get_animation_list()
		for c in clips:
			var cl = c.to_lower()
			if resolved_anims["idle"] == "" and ("idle" in cl or "stand" in cl):
				resolved_anims["idle"] = c
			elif resolved_anims["run"] == "" and ("run" in cl or "sprint" in cl or "jog" in cl):
				resolved_anims["run"] = c
			elif resolved_anims["walk"] == "" and ("walk" in cl or "move" in cl):
				resolved_anims["walk"] = c
			elif resolved_anims["attack_1"] == "" and ("slice" in cl or "slash" in cl or "attack" in cl or "chop" in cl or "regular_a" in cl):
				resolved_anims["attack_1"] = c
			elif resolved_anims["attack_2"] == "" and c != resolved_anims["attack_1"] and ("attack" in cl or "spin" in cl or "combo" in cl or "regular_b" in cl):
				resolved_anims["attack_2"] = c
			elif resolved_anims["attack_heavy"] == "" and ("heavy" in cl or "spin" in cl or "2h" in cl or "slam" in cl):
				resolved_anims["attack_heavy"] = c
			elif resolved_anims["dodge"] == "" and ("dodge" in cl or "roll" in cl or "dash" in cl or "jump" in cl):
				resolved_anims["dodge"] = c
			elif resolved_anims["parry"] == "" and ("block" in cl or "parry" in cl or "defend" in cl):
				resolved_anims["parry"] = c
			elif resolved_anims["hit"] == "" and ("hit" in cl or "damage" in cl):
				resolved_anims["hit"] = c
			elif resolved_anims["death"] == "" and ("death" in cl or "die" in cl):
				resolved_anims["death"] = c
		_play_anim("idle")

func equip_weapon_glb(weapon_data: Dictionary) -> void:
	equipped_weapon_name = str(weapon_data.get("name", "Relic Blade"))
	equipped_weapon_bonus = float(weapon_data.get("base_damage", 28.0)) - 22.0
	var raw_url = str(weapon_data.get("asset_url", weapon_data.get("glb_url", "")))
	var res_path = raw_url.replace("http://localhost:8000", "")
	if res_path.begins_with("/custom_assets/"):
		res_path = "res://assets/custom_asset_packs/" + res_path.substr(15)

	var attach_parent: Node3D = weapon_socket if (weapon_socket and is_instance_valid(weapon_socket)) else self
	for child in attach_parent.get_children():
		if child.name.begins_with("EquippedWeaponMesh"):
			child.queue_free()

	if res_path != "" and ResourceLoader.exists(res_path):
		var packed = load(res_path)
		if packed is PackedScene:
			var inst = packed.instantiate()
			if inst is Node3D:
				inst.name = "EquippedWeaponMesh"
				if attach_parent == self:
					inst.position = Vector3(0.42, 1.05, -0.35)
				attach_parent.add_child(inst)
	emit_signal("weapon_equipped_signal", weapon_data)
	emit_signal("combat_banner_signal", "EQUIPPED: " + equipped_weapon_name)

func _play_anim(slot: String, speed: float = 1.0, blend: float = 0.15) -> void:
	if not anim_player:
		return
	var clip = resolved_anims.get(slot, "")
	if clip != "" and anim_player.has_animation(clip):
		if anim_player.current_animation != clip or slot in ["attack_1", "attack_2", "attack_heavy", "dodge", "parry"]:
			anim_player.play(clip, blend, speed)

func _setup_weapon_hitbox() -> void:
	weapon_hitbox = Area3D.new()
	weapon_hitbox.name = "WeaponHitbox"
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(1.6, 1.2, 2.2)
	col.shape = box
	col.position = Vector3(0, 1.1, -1.2)
	weapon_hitbox.add_child(col)
	weapon_hitbox.monitoring = false
	weapon_hitbox.body_entered.connect(_on_weapon_hitbox_body_entered)
	add_child(weapon_hitbox)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.keycode == KEY_ESCAPE and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED

	# Toggle Lock-On [Q]
	if event is InputEventKey and event.keycode == KEY_Q and event.pressed:
		_toggle_target_lock()

	if active_genre == GenreStyle.DARK_SOULS_ACTION and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		if event is InputEventMouseMotion:
			rotate_y(-event.relative.x * 0.0028)
			spring_arm.rotation.x = clamp(spring_arm.rotation.x - event.relative.y * 0.0028, -1.1, 0.45)

	# Combat Inputs
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if active_genre == GenreStyle.BALDURS_GATE_CRPG and not Input.is_key_pressed(KEY_SHIFT):
				_handle_isometric_click()
			else:
				if Input.is_key_pressed(KEY_SHIFT):
					execute_heavy_attack()
				else:
					execute_light_combo()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			execute_parry_stance()

	if event is InputEventKey and event.keycode == KEY_SPACE and event.pressed:
		execute_dodge_roll()

func _physics_process(delta: float) -> void:
	stamina = min(max_stamina, stamina + 16.0 * delta)
	mana = min(max_mana, mana + 6.0 * delta)
	if riposte_ready_timer > 0.0:
		riposte_ready_timer = max(0.0, riposte_ready_timer - delta)
	emit_signal("stats_updated", hp, stamina, mana, action_points)

	if not is_on_floor():
		velocity.y -= 14.0 * delta

	if locked_target and is_instance_valid(locked_target):
		var target_pos = Vector3(locked_target.global_position.x, global_position.y, locked_target.global_position.z)
		if global_position.distance_to(target_pos) > 0.1:
			look_at(target_pos, Vector3.UP)

	if state in [CombatState.IDLE, CombatState.MOVE]:
		var input_vec = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
		if input_vec.length() > 0.05:
			var move_dir = (transform.basis * Vector3(input_vec.x, 0, input_vec.y)).normalized()
			velocity.x = move_dir.x * base_walk_speed
			velocity.z = move_dir.z * base_walk_speed
			state = CombatState.MOVE
			_play_anim("run" if resolved_anims["run"] != "" else "walk")
		elif active_genre != GenreStyle.DARK_SOULS_ACTION and nav_agent and not nav_agent.is_navigation_finished():
			var next_pt = nav_agent.get_next_path_position()
			var dir = (next_pt - global_position).normalized()
			velocity.x = dir.x * base_walk_speed
			velocity.z = dir.z * base_walk_speed
			if Vector2(dir.x, dir.z).length() > 0.05:
				look_at(global_position + Vector3(dir.x, 0, dir.z), Vector3.UP)
			state = CombatState.MOVE
			_play_anim("run" if resolved_anims["run"] != "" else "walk")
		else:
			velocity.x = move_toward(velocity.x, 0, base_walk_speed)
			velocity.z = move_toward(velocity.z, 0, base_walk_speed)
			state = CombatState.IDLE
			_play_anim("idle")

	move_and_slide()

func execute_light_combo() -> void:
	if state == CombatState.ATTACK_1:
		combo_queued = true
		return
	if state != CombatState.IDLE and state != CombatState.MOVE:
		return
	if active_genre == GenreStyle.BALDURS_GATE_CRPG:
		if action_points <= 0:
			emit_signal("combat_banner_signal", "OUT OF ACTION POINTS (Press [5] End Turn)")
			return
		action_points -= 1
	if stamina < 15.0:
		return

	stamina -= 15.0
	state = CombatState.ATTACK_1
	combo_queued = false
	_play_anim("attack_1", 1.25)

	var fwd = -transform.basis.z.normalized()
	velocity.x = fwd.x * 4.8
	velocity.z = fwd.z * 4.8

	await get_tree().create_timer(0.18).timeout
	weapon_hitbox.monitoring = true
	_check_proximity_enemies(26.0 + equipped_weapon_bonus, 18.0)
	await get_tree().create_timer(0.22).timeout
	weapon_hitbox.monitoring = false

	if combo_queued and stamina >= 15.0:
		stamina -= 15.0
		state = CombatState.ATTACK_2
		_play_anim("attack_2" if resolved_anims["attack_2"] != "" else "attack_1", 1.35)
		weapon_hitbox.monitoring = true
		_check_proximity_enemies(32.0 + equipped_weapon_bonus, 24.0)
		await get_tree().create_timer(0.26).timeout
		weapon_hitbox.monitoring = false

	state = CombatState.IDLE

func execute_heavy_attack() -> void:
	if state not in [CombatState.IDLE, CombatState.MOVE] or stamina < 30.0:
		return
	if active_genre == GenreStyle.BALDURS_GATE_CRPG:
		if action_points < 2:
			emit_signal("combat_banner_signal", "NEEDS 2 AP (Press [5] End Turn)")
			return
		action_points -= 2
	stamina -= 30.0
	state = CombatState.ATTACK_HEAVY
	_play_anim("attack_heavy" if resolved_anims["attack_heavy"] != "" else "attack_1", 0.95)
	var fwd = -transform.basis.z.normalized()
	velocity.x = fwd.x * 6.5
	velocity.z = fwd.z * 6.5
	await get_tree().create_timer(0.28).timeout
	weapon_hitbox.monitoring = true
	_check_proximity_enemies(48.0 + equipped_weapon_bonus, 35.0)
	await get_tree().create_timer(0.25).timeout
	weapon_hitbox.monitoring = false
	state = CombatState.IDLE

func execute_dodge_roll() -> void:
	if state in [CombatState.DODGE_ROLL, CombatState.STAGGERED] or stamina < 22.0:
		return
	stamina -= 22.0
	state = CombatState.DODGE_ROLL
	is_invincible = true
	_play_anim("dodge", 1.35)
	var fwd = -transform.basis.z.normalized()
	velocity.x = fwd.x * dodge_impulse
	velocity.z = fwd.z * dodge_impulse
	await get_tree().create_timer(0.36).timeout
	is_invincible = false
	state = CombatState.IDLE

func execute_parry_stance() -> void:
	if state not in [CombatState.IDLE, CombatState.MOVE] or stamina < 12.0:
		return
	stamina -= 12.0
	state = CombatState.PARRY
	is_parrying = true
	_play_anim("parry", 1.2)
	emit_signal("combat_banner_signal", "🛡️ PARRY WINDOW (200ms)")
	await get_tree().create_timer(0.22).timeout
	is_parrying = false
	state = CombatState.IDLE

func notify_parry_success(attacker: Node3D) -> void:
	riposte_ready_timer = 2.5
	emit_signal("combat_banner_signal", "⚡ PARRY RIPOSTE! CRITICAL WINDOW OPEN!")
	_trigger_hitstop(0.09)
	if attacker and attacker.has_method("apply_parry_stagger"):
		attacker.apply_parry_stagger()

func _check_proximity_enemies(base_dmg: float, poise_dmg: float) -> void:
	var final_dmg = base_dmg * (2.4 if riposte_ready_timer > 0.0 else 1.0)
	if riposte_ready_timer > 0.0:
		riposte_ready_timer = 0.0
		emit_signal("combat_banner_signal", "💥 CRITICAL RIPOSTE STRIKE! (" + str(int(final_dmg)) + " DMG)")
	for e in get_tree().get_nodes_in_group("enemies"):
		if e is Node3D and e != self and global_position.distance_to(e.global_position) <= 3.6:
			if e.has_method("apply_weapon_hit"):
				e.apply_weapon_hit(final_dmg, poise_dmg, "player_01")
				_trigger_hitstop(0.07)

func _on_weapon_hitbox_body_entered(body: Node3D) -> void:
	if body == self:
		return
	if body.has_method("apply_weapon_hit"):
		var dmg = (48.0 if state == CombatState.ATTACK_HEAVY else 26.0) + equipped_weapon_bonus
		if riposte_ready_timer > 0.0:
			dmg *= 2.4
			riposte_ready_timer = 0.0
		var poise_dmg = 35.0 if state == CombatState.ATTACK_HEAVY else 18.0
		body.apply_weapon_hit(dmg, poise_dmg, "player_01")
		_trigger_hitstop(0.07)

func _trigger_hitstop(duration_sec: float) -> void:
	Engine.time_scale = 0.05
	await get_tree().create_timer(duration_sec * 0.05).timeout
	Engine.time_scale = 1.0

func _toggle_target_lock() -> void:
	if locked_target:
		locked_target = null
		emit_signal("combat_banner_signal", "TARGET LOCK RELEASED")
		return
	var enemies = get_tree().get_nodes_in_group("enemies")
	var closest: Node3D = null
	var min_d: float = 20.0
	for e in enemies:
		if e is Node3D and is_instance_valid(e):
			var d = global_position.distance_to(e.global_position)
			if d < min_d:
				min_d = d
				closest = e
	locked_target = closest
	if locked_target:
		emit_signal("combat_banner_signal", "🎯 LOCKED ON: " + str(locked_target.name))

func _handle_isometric_click() -> void:
	if not iso_cam:
		return
	var mouse_pos = get_viewport().get_mouse_position()
	var from = iso_cam.project_ray_origin(mouse_pos)
	var to = from + iso_cam.project_ray_normal(mouse_pos) * 120.0
	var query = PhysicsRayQueryParameters3D.create(from, to)
	var hit = get_world_3d().direct_space_state.intersect_ray(query)
	if hit and nav_agent:
		nav_agent.target_position = hit.position

func _find_node_of_type(node: Node, type_name: String) -> Node:
	if node.get_class() == type_name:
		return node
	for child in node.get_children():
		var found = _find_node_of_type(child, type_name)
		if found:
			return found
	return null
