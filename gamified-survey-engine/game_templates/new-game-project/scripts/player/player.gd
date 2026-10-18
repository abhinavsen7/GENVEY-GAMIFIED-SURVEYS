class_name Player
extends CharacterBody3D
## Third-person player: grounded Soulslike movement, camera rig
## (CameraYaw/CameraPitch/SpringArm3D/Camera3D) and lock-on.
## Melee/special logic lives in the PlayerCombat child component; the skinned
## hero mesh, its animation blending, two-hand grip and foot contact live in
## the HeroRig component (scripts/player/hero_rig.gd).
## Physics layers: 1 = world, 2 = player, 3 (bit value 4) = enemies.

signal lock_target_changed(target: Node3D)

const WeaponLib := preload("res://scripts/weapons/weapon_models.gd")
const SFX := preload("res://scripts/audio/sfx.gd")

@export_group("Movement")
@export var walk_speed := 2.8
@export var run_speed := 5.6
@export var sprint_speed := 8.4
@export var acceleration := 34.0
@export var deceleration := 44.0
@export var turn_speed := 18.0
@export var jump_velocity := 7.0
@export var gravity := 24.0
@export_group("Dodge")
@export var dodge_speed := 15.0
@export var dodge_duration := 0.45
@export var dodge_iframes := 0.30
@export var dodge_cooldown := 0.35
@export_group("Camera")
@export var mouse_sensitivity := 0.0025
@export var camera_distance := 4.6
@export var camera_pitch := -0.32
@export var camera_follow_speed := 12.0
@export var lock_on_range := 18.0
@export_group("Health")
@export var max_health := 150.0
@export var hit_grace := 0.45

var health: Health
var combat: Node
var hero: Node        ## imported skinned hero: animation, grip, foot contact
var visual: Node3D       # rotates to face movement; forward is -Z
var rig: Node3D          # the mesh root; rolls/tilts for animations
var hand_attach: Node3D  # driven onto the sword hand bone by HeroRig
var arm_pivot: Node3D    # holds the sword; attack animations rotate this
var sword_tip: Node3D
var trail: GPUParticles3D
var cam_yaw: Node3D
var cam_pitch: Node3D
var camera: Camera3D
var lock_target: CharacterBody3D
var input_enabled := false
## 1.0 = rested, lower while moving; scales how much combat stance is blended in.
var stamina := 1.0

var _dodge_time := 0.0
var _dodge_cd := 0.0
var _dodge_dir := Vector3.ZERO
var _ghost_timer := 0.0
var _stun := 0.0
var _shake := 0.0
var _anim_t := 0.0
var _buffered_action := ""
var _buffer_timer := 0.0
const BUFFER_WINDOW := 0.25
var blade_mat: StandardMaterial3D  ## kept for compatibility (old sword glow)
var _weapon: Node3D
var _sword_light: OmniLight3D
## 1.0 = full camera shake; the pause menu "Reduce camera shake" sets 0.35.
@export var shake_scale := 1.0
var _left_pivot: Node3D  ## off-hand blade for Dual Blades; driven to the left hand
var _lock_marker: MeshInstance3D

const REST_ARM := Vector3(-0.8, 0.25, 0.0)

func _ready() -> void:
	add_to_group("player")
	axis_lock_angular_x = true
	axis_lock_angular_z = true
	collision_layer = 2
	collision_mask = 1 | 4
	floor_snap_length = 0.45
	floor_stop_on_slope = true
	floor_constant_speed = true
	floor_max_angle = deg_to_rad(48.0)
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.8
	col.shape = cap
	col.position.y = 0.9
	add_child(col)
	health = Health.new()
	health.max_health = max_health
	add_child(health)
	health.damaged.connect(_on_damaged)
	health.died.connect(_on_died)
	_build_visual()
	_build_camera()
	combat = PlayerCombat.new()
	combat.name = "Combat"
	add_child(combat)

# ---------------------------------------------------------------- visuals
func _mat(c: Color, emit := 0.0, metal := 0.3) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = metal
	m.roughness = 0.45
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

func _part(parent: Node3D, mesh: Mesh, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	parent.add_child(mi)
	return mi

## Build order matters: the hero mesh and the sword pivot both live under `rig`,
## so every existing tilt, roll and spin that rotates `rig` keeps working, and
## the mesh stays visual-only (collision is the capsule built in _ready, so
## movement speed never depends on the model).
func _build_visual() -> void:
	visual = Node3D.new()
	add_child(visual)
	rig = Node3D.new()
	rig.position.y = 0.9
	visual.add_child(rig)
	hero = HeroRig.new()
	hero.name = "HeroRig"
	# Solve the rig after AnimationPlayer evaluates the locomotion clip.
	hero.process_priority = 10
	add_child(hero)
	# The sword pivot is driven onto the sword hand bone every frame instead of
	# sitting at a fixed offset beside the hip.
	hand_attach = Node3D.new()
	hand_attach.name = "HandAttach"
	rig.add_child(hand_attach)
	arm_pivot = Node3D.new()
	arm_pivot.name = "ArmPivot"
	arm_pivot.rotation = Vector3.ZERO
	hero.setup(self, visual, rig, arm_pivot, hand_attach, REST_ARM)
	var socket: Node3D = hero.get_weapon_socket()
	if socket:
		socket.add_child(arm_pivot)
	else:
		hand_attach.add_child(arm_pivot)
	blade_mat = _mat(Color(0.4, 0.85, 1.0), 3.0, 0.9)
	equip_weapon("Ashen Edge")
	sword_tip = Node3D.new()
	sword_tip.position = Vector3(0, 0, -1.35)
	arm_pivot.add_child(sword_tip)
	# Weapon trail: world-space particles emitted along the blade while swinging.
	trail = GPUParticles3D.new()
	trail.amount = 90
	trail.lifetime = 0.22
	trail.local_coords = false
	trail.emitting = false
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(0.02, 0.02, 0.5)
	pm.gravity = Vector3.ZERO
	pm.initial_velocity_max = 0.2
	pm.scale_min = 0.6
	trail.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.12, 0.12)
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	qm.albedo_color = Color(0.45, 0.85, 1.0)
	qm.emission_enabled = true
	qm.emission = Color(0.45, 0.85, 1.0)
	qm.emission_energy_multiplier = 5.0
	q.material = qm
	trail.draw_pass_1 = q
	trail.position = Vector3(0, 0, -0.85)
	arm_pivot.add_child(trail)
	var glow := OmniLight3D.new()
	_sword_light = glow
	glow.light_color = Color(1.0, 0.2, 0.15)
	glow.light_energy = 0.8
	glow.omni_range = 3.0
	glow.position = Vector3(0, 0, -0.8)
	arm_pivot.add_child(glow)
	# Lock-on marker floats over the locked enemy.
	_lock_marker = MeshInstance3D.new()
	var mk := PrismMesh.new()
	mk.size = Vector3(0.3, 0.3, 0.05)
	_lock_marker.mesh = mk
	_lock_marker.rotation.z = PI
	_lock_marker.material_override = _mat(Color(1.0, 0.25, 0.2), 6.0)
	_lock_marker.top_level = true
	_lock_marker.visible = false
	add_child(_lock_marker)

## Swaps the visual weapon held in the sword hand (arm_pivot). Damage is
## handled separately by PlayerCombat.weapon_mult, so visuals never change stats.
func equip_weapon(weapon_name: String) -> void:
	if _weapon:
		_weapon.queue_free()
	_weapon = WeaponLib.build(weapon_name)
	arm_pivot.add_child(_weapon)
	if _left_pivot:
		_left_pivot.queue_free()
		_left_pivot = null
	# Dual Blades is the only off-hand weapon; HeroRig places it on the left hand.
	if weapon_name == "Dual Blades":
		_left_pivot = Node3D.new()
		_left_pivot.name = "LeftBlade"
		_left_pivot.add_child(WeaponLib.build(weapon_name))
		hand_attach.add_child(_left_pivot)
	var L := WeaponLib.blade_length(weapon_name)
	if trail:
		trail.position = Vector3(0, 0, -0.06 - L * 0.5)
		(trail.process_material as ParticleProcessMaterial).emission_box_extents = Vector3(0.02, 0.02, L * 0.45)
		var c := WeaponLib.rune_color(weapon_name)
		var qm := (trail.draw_pass_1 as QuadMesh).material as StandardMaterial3D
		qm.albedo_color = c
		qm.emission = c
	if sword_tip:
		sword_tip.position = Vector3(0, 0, -0.08 - L)
	if hero:
		hero.set_left_blade(_left_pivot)

func _build_camera() -> void:
	cam_yaw = Node3D.new()
	cam_yaw.name = "CameraYaw"
	cam_yaw.top_level = true
	add_child(cam_yaw)
	var pitch := Node3D.new()
	pitch.name = "CameraPitch"
	pitch.rotation.x = camera_pitch
	cam_pitch = pitch
	cam_yaw.add_child(pitch)
	var arm := SpringArm3D.new()
	arm.spring_length = camera_distance
	arm.collision_mask = 1
	var s := SphereShape3D.new()
	s.radius = 0.3
	arm.shape = s
	arm.add_excluded_object(get_rid())
	pitch.add_child(arm)
	camera = Camera3D.new()
	camera.fov = 70.0
	camera.current = true
	arm.add_child(camera)
	reset_camera()

## Instantly snaps the camera rig to the player's position (e.g. after spawn/teleport).
func reset_camera() -> void:
	if cam_yaw:
		cam_yaw.global_position = global_position + Vector3(0, 1.5, 0)

# ---------------------------------------------------------------- input
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if not input_enabled or health.dead:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and lock_target == null:
		cam_yaw.rotation.y -= event.relative.x * mouse_sensitivity
		if cam_pitch:
			cam_pitch.rotation.x = clampf(cam_pitch.rotation.x - event.relative.y * mouse_sensitivity, -1.2, 0.4)
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if event.is_action_pressed("lock_on"):
		_toggle_lock()

func get_move_input() -> Vector3:
	var v := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	if v.length_squared() < 0.001:
		return Vector3.ZERO
	# Planar camera-relative motion preserving analog magnitude
	var yaw := cam_yaw.rotation.y if cam_yaw else 0.0
	var cam_basis := Basis(Vector3.UP, yaw)
	return cam_basis * Vector3(v.x, 0.0, v.y)

func is_dodging() -> bool:
	return _dodge_time > 0.0

## Faces the lock target, or the input direction, before an attack.
func face_attack_direction() -> void:
	var dir := Vector3.ZERO
	if lock_target and is_instance_valid(lock_target):
		dir = Vector3(lock_target.global_position.x - global_position.x, 0.0, lock_target.global_position.z - global_position.z)
	else:
		dir = get_move_input()
	dir.y = 0.0
	if dir.length_squared() > 0.001 and visual:
		visual.rotation.y = atan2(-dir.x, -dir.z)
		visual.rotation.x = 0.0
		visual.rotation.z = 0.0

func forward() -> Vector3:
	return -visual.global_basis.z if visual else Vector3.FORWARD

# ---------------------------------------------------------------- physics
func _physics_process(delta: float) -> void:
	_dodge_cd = maxf(_dodge_cd - delta, 0.0)
	_stun = maxf(_stun - delta, 0.0)
	_buffer_timer = maxf(_buffer_timer - delta, 0.0)
	if _buffer_timer <= 0.0:
		_buffered_action = ""
	if is_on_floor() and velocity.y <= 0.0:
		velocity.y = -4.0  # Ground adhesion force keeping character firmly glued to floor/slopes
	else:
		velocity.y -= gravity * delta
	if (health and health.dead) or not input_enabled:
		var cur_h_stop := Vector2(velocity.x, velocity.z).move_toward(Vector2.ZERO, deceleration * delta)
		velocity.x = cur_h_stop.x
		velocity.z = cur_h_stop.y
		move_and_slide()
		return
	var raw_v := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := get_move_input()
	if _dodge_time > 0.0:
		_process_dodge(delta)
	elif _stun > 0.0:
		var cur_h_stun := Vector2(velocity.x, velocity.z).move_toward(Vector2.ZERO, 30.0 * delta)
		velocity.x = cur_h_stun.x
		velocity.z = cur_h_stun.y
	elif combat and combat.is_busy():
		# Attacks root the player except for the scripted lunge.
		var lunge: float = float(combat.current_lunge())
		var f: Vector3 = forward() * lunge
		velocity.x = f.x
		velocity.z = f.z
		if Input.is_action_just_pressed("dodge"):
			_buffered_action = "dodge"
			_buffer_timer = BUFFER_WINDOW
	else:
		var sprinting := Input.is_action_pressed("sprint") and dir != Vector3.ZERO
		var target_speed := walk_speed
		if sprinting:
			target_speed = sprint_speed
		elif dir.length_squared() > 0.01:
			target_speed = lerpf(walk_speed, run_speed, clampf(raw_v.length(), 0.0, 1.0))
		var rate := acceleration if dir != Vector3.ZERO else deceleration
		var cur_h := Vector2(velocity.x, velocity.z)
		var tgt_h := Vector2(dir.x, dir.z) * target_speed
		cur_h = cur_h.move_toward(tgt_h, rate * delta)
		velocity.x = cur_h.x
		velocity.z = cur_h.y
		
		var is_locked: bool = lock_target != null and is_instance_valid(lock_target) and not lock_target.is_dead()
		if is_locked:
			# Dark Souls Lock-On Strafing: character stays facing the enemy while strafing/backpedaling
			var to_t := Vector3(lock_target.global_position.x - global_position.x, 0.0, lock_target.global_position.z - global_position.z)
			if to_t.length_squared() > 0.01 and visual:
				var target_yaw := atan2(-to_t.x, -to_t.z)
				visual.rotation.y = lerp_angle(visual.rotation.y, target_yaw, turn_speed * 1.5 * delta)
				visual.rotation.x = 0.0
				visual.rotation.z = 0.0
		elif dir != Vector3.ZERO and visual:
			# Free-Running: character smoothly turns toward travel direction
			var target_yaw := atan2(-dir.x, -dir.z)
			visual.rotation.y = lerp_angle(visual.rotation.y, target_yaw, turn_speed * delta)
			visual.rotation.x = 0.0
			visual.rotation.z = 0.0
		if Input.is_action_just_pressed("jump") and is_on_floor():
			velocity.y = jump_velocity
			if hero and hero.has_method("on_jump"):
				hero.on_jump()
		if (Input.is_action_just_pressed("dodge") or _buffered_action == "dodge") and _dodge_cd <= 0.0:
			_buffered_action = ""
			_start_dodge(dir)
	stamina = move_toward(stamina, 1.0 if velocity.length() < 0.6 else 0.55, delta * 1.5)
	move_and_slide()
	_animate_locomotion(delta)

func _start_dodge(dir: Vector3) -> void:
	_dodge_dir = dir.normalized() if dir.length_squared() > 0.01 else forward()
	_dodge_dir.y = 0.0
	_dodge_dir = _dodge_dir.normalized()
	if visual:
		visual.rotation.y = atan2(-_dodge_dir.x, -_dodge_dir.z)
		visual.rotation.x = 0.0
		visual.rotation.z = 0.0
	var dur := dodge_duration
	var rolled: bool = hero != null and hero.play_roll()
	if rolled:
		var rd: float = hero.roll_duration()
		dur = rd if rd > 0.05 else dodge_duration
	_dodge_time = dur
	_dodge_cd = dur + dodge_cooldown
	if health:
		health.invulnerable = true
	collision_mask = 1  # roll through enemies
	if combat:
		combat.cancel()
	if rig:
		rig.rotation.x = 0.0
		rig.rotation.z = 0.0
	SFX.dodge(self)
	if is_inside_tree():
		get_tree().create_timer(dodge_iframes).timeout.connect(_end_iframes)

func _end_iframes() -> void:
	if _stun <= 0.0 and health:
		health.invulnerable = false

func _end_grace() -> void:
	if _dodge_time <= 0.0 and health:
		health.invulnerable = false

func _process_dodge(delta: float) -> void:
	_dodge_time -= delta
	velocity.x = _dodge_dir.x * dodge_speed
	velocity.z = _dodge_dir.z * dodge_speed
	if _dodge_time <= 0.0:
		collision_mask = 1 | 4
		if rig:
			rig.rotation.x = 0.0
			rig.rotation.z = 0.0

func _animate_locomotion(delta: float) -> void:
	if _dodge_time > 0.0:
		return
	var is_combat_busy: bool = combat != null and combat.is_busy()
	if hero:
		# When busy in combat, pass Vector3.ZERO so legs plant into stance instead of cycling run in place
		var leg_vel := Vector3.ZERO if is_combat_busy else velocity
		hero.update_locomotion(leg_vel, delta)
	if is_combat_busy:
		return
	var hs := Vector2(velocity.x, velocity.z).length()
	_anim_t += delta * lerpf(1.5, 7.0, clampf(hs / maxf(sprint_speed, 0.1), 0.0, 1.0))
	if (hero == null or not hero.has_skeleton()) and rig:
		# No imported rig: keep the old procedural bob as a fallback.
		rig.position.y = 0.9 + sin(_anim_t) * (0.03 if hs < 0.5 else 0.06)
	if (hero == null or not hero.has_skeleton()) and arm_pivot:
		arm_pivot.rotation = arm_pivot.rotation.lerp(REST_ARM + Vector3(sin(_anim_t) * 0.08 * minf(hs, 1.0), 0, 0), 8.0 * delta)
	elif arm_pivot:
		arm_pivot.rotation = Vector3.ZERO

func _process(delta: float) -> void:
	# The HeroRig child solves the skeleton, the grip and the foot contact on its
	# own, one step before the camera reads the new pose.
	# Smooth camera follow + lock-on framing + shake.
	var target_pos := global_position + Vector3(0, 1.5, 0)
	cam_yaw.global_position = cam_yaw.global_position.lerp(target_pos, clampf(camera_follow_speed * delta, 0.0, 1.0))
	if lock_target:
		if not is_instance_valid(lock_target) or lock_target.is_dead():
			_set_lock(null)
		else:
			var to_t := (lock_target.global_position - global_position) * Vector3(1, 0, 1)
			if to_t.length() > 0.5:
				cam_yaw.rotation.y = lerp_angle(cam_yaw.rotation.y, atan2(-to_t.x, -to_t.z), 6.0 * delta)
			if cam_pitch:
				var to_t_3d := lock_target.global_position + Vector3(0, 1.0, 0) - (global_position + Vector3(0, 1.5, 0))
				var dist_flat := Vector2(to_t_3d.x, to_t_3d.z).length()
				var desired_pitch := clampf(-atan2(to_t_3d.y, maxf(dist_flat, 0.1)) - 0.2, -1.0, 0.2)
				cam_pitch.rotation.x = lerp_angle(cam_pitch.rotation.x, desired_pitch, 4.0 * delta)
			_lock_marker.global_position = lock_target.global_position + Vector3(0, lock_target.bar_height + 0.5, 0)
	if _shake > 0.0:
		_shake = maxf(_shake - delta * 2.5, 0.0)
		var s := _shake * _shake * 0.35
		camera.h_offset = randf_range(-s, s)
		camera.v_offset = randf_range(-s, s)
	else:
		camera.h_offset = 0.0
		camera.v_offset = 0.0

func shake(amount: float) -> void:
	_shake = maxf(_shake, amount * shake_scale)

## Weapon trail colour/intensity per attack strength (set by PlayerCombat).
func set_trail(c: Color, energy: float) -> void:
	var qm := (trail.draw_pass_1 as QuadMesh).material as StandardMaterial3D
	qm.albedo_color = c
	qm.emission = c
	qm.emission_energy_multiplier = energy

## Crimson blade glow: brighter during skills and the ultimate.
func set_blade_glow(energy: float) -> void:
	if _sword_light:
		create_tween().tween_property(_sword_light, "light_energy", energy, 0.12)

# ---------------------------------------------------------------- lock-on
func _toggle_lock() -> void:
	if lock_target:
		_set_lock(null)
		return
	var best: CharacterBody3D = null
	var best_d := lock_on_range
	for e in get_tree().get_nodes_in_group("enemies"):
		if e.is_dead():
			continue
		var d := global_position.distance_to(e.global_position)
		if d < best_d:
			best_d = d
			best = e
	_set_lock(best)

func _set_lock(t: CharacterBody3D) -> void:
	lock_target = t
	_lock_marker.visible = t != null
	lock_target_changed.emit(t)

# ---------------------------------------------------------------- damage
func _on_damaged(amount: float, source_pos: Vector3, _power: int) -> void:
	combat.cancel()
	_stun = 0.3
	health.invulnerable = true
	get_tree().create_timer(hit_grace).timeout.connect(_end_grace)
	var away := (global_position - source_pos) * Vector3(1, 0, 1)
	if away.length() > 0.01:
		velocity += away.normalized() * 6.0
	shake(0.8)
	SFX.hurt(self)
	FX.damage_number(get_parent(), global_position + Vector3(0, 2.0, 0), amount, true)
	# Hit reaction: the model flashes and the grip recoils.
	if hero:
		hero.flash()
		hero.flinch()

func _on_died() -> void:
	combat.cancel()
	_set_lock(null)
	# Hand the body over to HeroRig so the arms stop holding the sword and the
	# collapse blends out of the stance.
	if hero:
		hero.release()
	if rig:
		rig.rotation.x = 0.0
		rig.rotation.z = 0.0
