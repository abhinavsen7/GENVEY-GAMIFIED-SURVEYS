class_name Player
extends CharacterBody3D
## Third-person player: movement, sprint, jump, dodge roll with i-frames,
## camera rig (CameraYaw/CameraPitch/SpringArm3D/Camera3D) and lock-on.
## Melee/special logic lives in the PlayerCombat child component.
## Physics layers: 1 = world, 2 = player, 3 (bit value 4) = enemies.

signal lock_target_changed(target: Node3D)

const WeaponLib := preload("res://scripts/weapons/weapon_models.gd")

@export_group("Movement")
@export var walk_speed := 5.0
@export var sprint_speed := 8.5
@export var acceleration := 40.0
@export var turn_speed := 14.0
@export var jump_velocity := 7.0
@export var gravity := 22.0
@export_group("Dodge")
@export var dodge_speed := 15.0
@export var dodge_duration := 0.35
@export var dodge_iframes := 0.28
@export var dodge_cooldown := 0.45
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
var combat: PlayerCombat
var visual: Node3D       # rotates to face movement; forward is -Z
var rig: Node3D          # rolls/tilts for animations
var arm_pivot: Node3D    # holds the sword; attack animations rotate this
var sword_tip: Node3D
var trail: GPUParticles3D
var cam_yaw: Node3D
var camera: Camera3D
var lock_target: Enemy
var input_enabled := false

var _dodge_time := 0.0
var _dodge_cd := 0.0
var _dodge_dir := Vector3.ZERO
var _ghost_timer := 0.0
var _stun := 0.0
var _shake := 0.0
var _anim_t := 0.0
var _body_mat: StandardMaterial3D
var blade_mat: StandardMaterial3D  ## kept for compatibility (old sword glow)
var _weapon: Node3D
var _left_pivot: Node3D  ## off-hand blade for Dual Blades; mirrors the sword arm
var _lock_marker: MeshInstance3D

const REST_ARM := Vector3(-0.8, 0.25, 0.0)

func _ready() -> void:
	add_to_group("player")
	collision_layer = 2
	collision_mask = 1 | 4
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

func _build_visual() -> void:
	visual = Node3D.new()
	add_child(visual)
	rig = Node3D.new()
	rig.position.y = 0.9
	visual.add_child(rig)
	_body_mat = _mat(Color(0.16, 0.17, 0.22), 0.0, 0.7)
	var body := CapsuleMesh.new()
	body.radius = 0.33
	body.height = 1.3
	_part(rig, body, Vector3(0, -0.1, 0), _body_mat)
	var cloak := CylinderMesh.new()
	cloak.top_radius = 0.3
	cloak.bottom_radius = 0.5
	cloak.height = 0.9
	_part(rig, cloak, Vector3(0, -0.4, 0.06), _mat(Color(0.35, 0.05, 0.08), 0.0, 0.0))
	var head := SphereMesh.new()
	head.radius = 0.2
	head.height = 0.4
	_part(rig, head, Vector3(0, 0.75, 0), _mat(Color(0.2, 0.2, 0.25), 0.0, 0.8))
	var eye := BoxMesh.new()
	eye.size = Vector3(0.26, 0.04, 0.05)
	_part(rig, eye, Vector3(0, 0.77, -0.18), _mat(Color(0.3, 0.8, 1.0), 6.0))
	var pauld := SphereMesh.new()
	pauld.radius = 0.16
	pauld.height = 0.25
	_part(rig, pauld, Vector3(-0.38, 0.45, 0), _body_mat)
	arm_pivot = Node3D.new()
	arm_pivot.position = Vector3(0.38, 0.45, 0)
	arm_pivot.rotation = REST_ARM
	rig.add_child(arm_pivot)
	blade_mat = _mat(Color(0.4, 0.85, 1.0), 3.0, 0.9)
	equip_weapon("Temple Sword")
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
	glow.light_color = Color(0.4, 0.8, 1.0)
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
	if weapon_name == "Dual Blades":
		_left_pivot = Node3D.new()
		_left_pivot.position = Vector3(-0.38, 0.45, 0)
		rig.add_child(_left_pivot)
		_left_pivot.add_child(WeaponLib.build(weapon_name))
	var L := WeaponLib.blade_length(weapon_name)
	if trail:
		trail.position = Vector3(0, 0, -0.12 - L * 0.55)
		(trail.process_material as ParticleProcessMaterial).emission_box_extents = Vector3(0.02, 0.02, L * 0.45)
		var c := WeaponLib.rune_color(weapon_name)
		var qm := (trail.draw_pass_1 as QuadMesh).material as StandardMaterial3D
		qm.albedo_color = c
		qm.emission = c
	if sword_tip:
		sword_tip.position = Vector3(0, 0, -0.2 - L)

func _build_camera() -> void:
	cam_yaw = Node3D.new()
	cam_yaw.name = "CameraYaw"
	cam_yaw.top_level = true
	add_child(cam_yaw)
	var pitch := Node3D.new()
	pitch.name = "CameraPitch"
	pitch.rotation.x = camera_pitch
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
	cam_yaw.global_position = global_position + Vector3(0, 1.5, 0)

# ---------------------------------------------------------------- input
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if not input_enabled or health.dead:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and lock_target == null:
		cam_yaw.rotation.y -= event.relative.x * mouse_sensitivity
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if event.is_action_pressed("lock_on"):
		_toggle_lock()

func get_move_input() -> Vector3:
	var v := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	if v == Vector2.ZERO:
		return Vector3.ZERO
	# Camera-relative, -Z is forward.
	return (cam_yaw.global_basis * Vector3(v.x, 0, v.y)).normalized() * Vector3(1, 0, 1)

func is_dodging() -> bool:
	return _dodge_time > 0.0

## Faces the lock target, or the input direction, before an attack.
func face_attack_direction() -> void:
	var dir := Vector3.ZERO
	if lock_target and is_instance_valid(lock_target):
		dir = (lock_target.global_position - global_position) * Vector3(1, 0, 1)
	else:
		dir = get_move_input()
	if dir.length() > 0.01:
		visual.rotation.y = atan2(-dir.x, -dir.z)

func forward() -> Vector3:
	return -visual.global_basis.z

# ---------------------------------------------------------------- physics
func _physics_process(delta: float) -> void:
	_dodge_cd = maxf(_dodge_cd - delta, 0.0)
	_stun = maxf(_stun - delta, 0.0)
	if not is_on_floor():
		velocity.y -= gravity * delta
	if health.dead or not input_enabled:
		velocity.x = move_toward(velocity.x, 0, acceleration * delta)
		velocity.z = move_toward(velocity.z, 0, acceleration * delta)
		move_and_slide()
		return
	var dir := get_move_input()
	if _dodge_time > 0.0:
		_process_dodge(delta)
	elif _stun > 0.0:
		velocity.x = move_toward(velocity.x, 0, 30.0 * delta)
		velocity.z = move_toward(velocity.z, 0, 30.0 * delta)
	elif combat.is_busy():
		# Attacks root the player except for the scripted lunge.
		var lunge := combat.current_lunge()
		var f := forward() * lunge
		velocity.x = f.x
		velocity.z = f.z
	else:
		var sprinting := Input.is_action_pressed("sprint") and dir != Vector3.ZERO
		var speed := sprint_speed if sprinting else walk_speed
		velocity.x = move_toward(velocity.x, dir.x * speed, acceleration * delta)
		velocity.z = move_toward(velocity.z, dir.z * speed, acceleration * delta)
		if lock_target and is_instance_valid(lock_target):
			var to_t := (lock_target.global_position - global_position) * Vector3(1, 0, 1)
			if to_t.length() > 0.1:
				visual.rotation.y = lerp_angle(visual.rotation.y, atan2(-to_t.x, -to_t.z), turn_speed * delta)
		elif dir != Vector3.ZERO:
			visual.rotation.y = lerp_angle(visual.rotation.y, atan2(-dir.x, -dir.z), turn_speed * delta)
		if Input.is_action_just_pressed("jump") and is_on_floor():
			velocity.y = jump_velocity
		if Input.is_action_just_pressed("dodge") and _dodge_cd <= 0.0:
			_start_dodge(dir)
	move_and_slide()
	_animate_locomotion(delta)

func _start_dodge(dir: Vector3) -> void:
	_dodge_dir = dir if dir != Vector3.ZERO else -forward()
	visual.rotation.y = atan2(-_dodge_dir.x, -_dodge_dir.z)
	_dodge_time = dodge_duration
	_dodge_cd = dodge_duration + dodge_cooldown
	health.invulnerable = true
	collision_mask = 1  # roll through enemies
	combat.cancel()
	var t := create_tween()
	rig.rotation.x = 0.0
	t.tween_property(rig, "rotation:x", -TAU, dodge_duration).set_trans(Tween.TRANS_SINE)
	t.tween_callback(func(): rig.rotation.x = 0.0)
	get_tree().create_timer(dodge_iframes).timeout.connect(_end_iframes)

func _end_iframes() -> void:
	if _stun <= 0.0:
		health.invulnerable = false

func _end_grace() -> void:
	if _dodge_time <= 0.0:
		health.invulnerable = false

func _process_dodge(delta: float) -> void:
	_dodge_time -= delta
	velocity.x = _dodge_dir.x * dodge_speed
	velocity.z = _dodge_dir.z * dodge_speed
	_ghost_timer -= delta
	if _ghost_timer <= 0.0:
		_ghost_timer = 0.06
		FX.afterimage(get_parent(), global_transform)
	if _dodge_time <= 0.0:
		collision_mask = 1 | 4

func _animate_locomotion(delta: float) -> void:
	if combat.is_busy() or _dodge_time > 0.0:
		return
	var hs := Vector2(velocity.x, velocity.z).length()
	var freq := 2.0 if hs < 0.5 else (10.0 if hs < 6.0 else 14.0)
	_anim_t += delta * freq
	var bob := sin(_anim_t) * (0.03 if hs < 0.5 else 0.07)
	rig.position.y = 0.9 + bob
	rig.rotation.x = lerpf(rig.rotation.x, -clampf(hs / sprint_speed, 0.0, 1.0) * 0.25, 10.0 * delta)
	arm_pivot.rotation = arm_pivot.rotation.lerp(REST_ARM + Vector3(sin(_anim_t) * 0.1 * minf(hs, 1.0), 0, 0), 10.0 * delta)

func _process(delta: float) -> void:
	if _left_pivot:
		var a := arm_pivot.rotation
		_left_pivot.rotation = Vector3(a.x, -a.y, -a.z)
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
	_shake = maxf(_shake, amount)

# ---------------------------------------------------------------- lock-on
func _toggle_lock() -> void:
	if lock_target:
		_set_lock(null)
		return
	var best: Enemy = null
	var best_d := lock_on_range
	for e in get_tree().get_nodes_in_group("enemies"):
		if e.is_dead():
			continue
		var d := global_position.distance_to(e.global_position)
		if d < best_d:
			best_d = d
			best = e
	_set_lock(best)

func _set_lock(t: Enemy) -> void:
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
	FX.damage_number(get_parent(), global_position + Vector3(0, 2.0, 0), amount, true)
	# Hit reaction: flinch backwards and flash red.
	_body_mat.emission_enabled = true
	_body_mat.emission = Color(1, 0.1, 0.1)
	_body_mat.emission_energy_multiplier = 3.0
	var t := create_tween()
	t.tween_property(rig, "rotation:x", 0.45, 0.08)
	t.tween_property(rig, "rotation:x", 0.0, 0.2)
	t.parallel().tween_property(_body_mat, "emission_energy_multiplier", 0.0, 0.25)

func _on_died() -> void:
	combat.cancel()
	_set_lock(null)
	var t := create_tween()
	t.tween_property(rig, "rotation:x", PI * 0.5, 0.5).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	t.parallel().tween_property(rig, "position:y", 0.35, 0.5)
