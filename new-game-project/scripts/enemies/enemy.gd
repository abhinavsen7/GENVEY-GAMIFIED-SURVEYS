class_name Enemy
extends CharacterBody3D
## Enemy AI with a simple, reliable state machine:
## IDLE -> PATROL -> CHASE -> ATTACK (wind-up, strike, optional combo) -> RECOVER,
## plus STAGGER (interrupt) and DEAD. Movement uses NavigationAgent3D on the
## arena navmesh with a direct-steer fallback. Presets are applied by setup().

signal died(enemy: Enemy)

enum Kind { GRUNT, KNIGHT, ASSASSIN, ELITE }
enum State { IDLE, PATROL, CHASE, ATTACK, RECOVER, STAGGER, DEAD }

@export var kind: Kind = Kind.GRUNT
@export var max_health := 60.0
@export var move_speed := 3.8
@export var detect_radius := 16.0
@export var attack_range := 1.8
@export var attack_damage := 10.0
@export var attack_windup := 0.45
@export var combo_windup := 0.22      ## wind-up for follow-up hits in a combo
@export var combo_hits := 1
@export var recover_time := 1.2       ## cooldown after a full attack string
@export var poise := 1                ## hits with stagger power >= poise interrupt
@export var stagger_threshold := 999.0 ## accumulated damage that forces a stagger
@export var stagger_time := 0.6
@export var flanker := false
@export var gravity := 22.0

var target: Player
var state := State.IDLE
var health: Health
var bar_height := 2.2
var _t := 0.0
var _hits_left := 0
var _repath := 0.0
var _home := Vector3.ZERO
var _patrol_point := Vector3.ZERO
var _poise_dmg := 0.0
var _flank_side := 1.0
var _agent: NavigationAgent3D
var _rig: Node3D
var _arm: Node3D
var _body_mat: StandardMaterial3D
var _eye_mat: StandardMaterial3D
var _bar: Node3D
var _bar_fill: MeshInstance3D
var _tween: Tween
var _accent := Color(1, 0.15, 0.1)

const ARM_REST := Vector3(-0.6, 0, 0)

# Rigged library monsters (dungeon-dark-fantasy). GLB forward is +Z, so the
# model is turned 180 degrees to match the Godot -Z forward used by the AI.
const LIB := "res://assets/library/dungeon-dark-fantasy/"
const MODELS := {
	Kind.GRUNT: LIB + "hushed-acolyte.glb",
	Kind.KNIGHT: LIB + "hushed-brute.glb",
	Kind.ASSASSIN: LIB + "vine-stalker.glb",
	Kind.ELITE: LIB + "hushed-prophet.glb",
}
const REST_HEIGHT := {Kind.GRUNT: 1.8, Kind.KNIGHT: 2.35, Kind.ASSASSIN: 1.11, Kind.ELITE: 3.17}
const TARGET_HEIGHT := {Kind.GRUNT: 1.95, Kind.KNIGHT: 2.7, Kind.ASSASSIN: 1.25, Kind.ELITE: 3.2}
const BODY_RADIUS := {Kind.GRUNT: 0.4, Kind.KNIGHT: 0.6, Kind.ASSASSIN: 0.55, Kind.ELITE: 0.7}

var _model: Node3D
var _anim: AnimationPlayer
var _clips := {}            # logical name -> real clip name
var _flash_mat: StandardMaterial3D
var _cur_clip := ""

## Instances the rigged model; returns false (primitive fallback) if missing.
func _try_model() -> bool:
	var path: String = MODELS.get(kind, "")
	if path == "" or not ResourceLoader.exists(path):
		return false
	var ps := load(path) as PackedScene
	if ps == null:
		return false
	_model = ps.instantiate() as Node3D
	var s: float = TARGET_HEIGHT[kind] / REST_HEIGHT[kind]
	_model.scale = Vector3.ONE * s
	_model.rotation.y = PI
	add_child(_model)
	_flash_mat = StandardMaterial3D.new()
	_flash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_flash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_flash_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_flash_mat.albedo_color = Color(1, 0.9, 0.8, 0.0)
	for mi in _model.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_overlay = _flash_mat
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var players := _model.find_children("*", "AnimationPlayer", true, false)
	if not players.is_empty():
		_anim = players[0]
		for real in _anim.get_animation_list():
			var low := String(real).to_lower()
			for logical in ["idle", "walk", "run", "attack", "hit", "death", "pounce", "prowl"]:
				if low.ends_with(logical) and not _clips.has(logical):
					_clips[logical] = real
					if logical in ["idle", "walk", "run", "prowl"]:
						_anim.get_animation(real).loop_mode = Animation.LOOP_LINEAR
	return true

func _play(logical: String, speed := 1.0, restart := false) -> void:
	if _anim == null or not _clips.has(logical):
		return
	var clip: String = _clips[logical]
	if clip == _cur_clip and not restart:
		return
	_cur_clip = clip
	_anim.play(clip, 0.15, speed)
	if restart:
		_anim.seek(0.0, true)

func _update_locomotion_anim() -> void:
	if state in [State.ATTACK, State.STAGGER, State.DEAD]:
		return
	var hs := Vector2(velocity.x, velocity.z).length()
	if hs < 0.3:
		_play("idle")
	elif hs < move_speed * 0.6:
		_play("walk")
	else:
		_play("run", clampf(hs / maxf(move_speed, 0.1), 0.8, 1.4))

func setup(k: Kind) -> void:
	kind = k
	match k:
		Kind.GRUNT:
			max_health = 55.0; move_speed = 3.6; attack_damage = 10.0; attack_windup = 0.5
			recover_time = 1.3; poise = 1; attack_range = 1.7
		Kind.KNIGHT:
			max_health = 180.0; move_speed = 2.3; attack_damage = 26.0; attack_windup = 0.95
			recover_time = 1.8; poise = 4; stagger_threshold = 70.0; attack_range = 2.4
			stagger_time = 1.1; _accent = Color(1.0, 0.5, 0.1)
		Kind.ASSASSIN:
			max_health = 45.0; move_speed = 6.2; attack_damage = 14.0; attack_windup = 0.3
			combo_windup = 0.16; combo_hits = 3; recover_time = 1.4; poise = 2; flanker = true
			attack_range = 1.6; _accent = Color(0.75, 0.3, 1.0)
		Kind.ELITE:
			max_health = 420.0; move_speed = 3.0; attack_damage = 32.0; attack_windup = 0.8
			combo_windup = 0.5; combo_hits = 2; recover_time = 1.5; poise = 5
			stagger_threshold = 120.0; attack_range = 3.0; stagger_time = 1.0
			_accent = Color(1.0, 0.8, 0.2)

func is_dead() -> bool:
	return state == State.DEAD

func _ready() -> void:
	add_to_group("enemies")
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	_home = global_position
	_flank_side = 1.0 if randf() > 0.5 else -1.0
	var sc := _scale()
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4 * sc
	cap.height = 1.8 * sc
	if ResourceLoader.exists(MODELS.get(kind, "")):
		# Collision matches the rigged model's real height (1 unit = 1 m).
		cap.radius = BODY_RADIUS[kind]
		cap.height = maxf(TARGET_HEIGHT[kind], cap.radius * 2.0 + 0.1)
	col.shape = cap
	col.position.y = cap.height * 0.5
	add_child(col)
	health = Health.new()
	health.max_health = max_health
	add_child(health)
	health.died.connect(_on_died)
	_agent = NavigationAgent3D.new()
	_agent.path_desired_distance = 0.6
	_agent.target_desired_distance = 0.8
	_agent.radius = 0.5
	add_child(_agent)
	_build_visual(sc)
	_state(State.IDLE, randf_range(0.3, 1.0))

func _scale() -> float:
	match kind:
		Kind.KNIGHT: return 1.25
		Kind.ASSASSIN: return 0.9
		Kind.ELITE: return 1.6
	return 1.0

# ---------------------------------------------------------------- visuals
func _mesh(parent: Node3D, m: Mesh, pos: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.position = pos
	mi.material_override = mat
	parent.add_child(mi)

func _build_visual(sc: float) -> void:
	_rig = Node3D.new()
	_rig.scale = Vector3.ONE * sc
	add_child(_rig)
	_body_mat = StandardMaterial3D.new()
	_body_mat.emission_enabled = true
	_body_mat.emission_energy_multiplier = 0.0
	_eye_mat = StandardMaterial3D.new()
	_eye_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_eye_mat.albedo_color = _accent
	_eye_mat.emission_enabled = true
	_eye_mat.emission = _accent
	_eye_mat.emission_energy_multiplier = 4.0
	var has_model := _try_model()
	var heavy := kind == Kind.KNIGHT or kind == Kind.ELITE
	_body_mat.albedo_color = Color(0.32, 0.3, 0.3) if heavy else (Color(0.12, 0.06, 0.16) if kind == Kind.ASSASSIN else Color(0.08, 0.07, 0.09))
	_body_mat.metallic = 0.8 if heavy else 0.1
	_body_mat.roughness = 0.4 if heavy else 0.8
	if has_model:
		pass  # rigged library model replaces the primitive body
	elif heavy:
		var torso := BoxMesh.new()
		torso.size = Vector3(0.85, 0.95, 0.5)
		_mesh(_rig, torso, Vector3(0, 1.05, 0), _body_mat)
		var legs := BoxMesh.new()
		legs.size = Vector3(0.6, 0.6, 0.4)
		_mesh(_rig, legs, Vector3(0, 0.3, 0), _body_mat)
		var helm := BoxMesh.new()
		helm.size = Vector3(0.42, 0.42, 0.42)
		_mesh(_rig, helm, Vector3(0, 1.75, 0), _body_mat)
		var slit := BoxMesh.new()
		slit.size = Vector3(0.3, 0.05, 0.05)
		_mesh(_rig, slit, Vector3(0, 1.78, -0.21), _eye_mat)
	else:
		var body := CapsuleMesh.new()
		body.radius = 0.3 if kind == Kind.GRUNT else 0.24
		body.height = 1.5
		_mesh(_rig, body, Vector3(0, 0.8, 0), _body_mat)
		var head := SphereMesh.new()
		head.radius = 0.2
		head.height = 0.4
		_mesh(_rig, head, Vector3(0, 1.6, -0.08), _body_mat)
		var eye := SphereMesh.new()
		eye.radius = 0.04
		eye.height = 0.08
		_mesh(_rig, eye, Vector3(-0.08, 1.64, -0.25), _eye_mat)
		_mesh(_rig, eye, Vector3(0.08, 1.64, -0.25), _eye_mat)
	_arm = Node3D.new()
	_arm.position = Vector3(0.45 if heavy else 0.32, 1.3, 0)
	_arm.rotation = ARM_REST
	_rig.add_child(_arm)
	var wpn := BoxMesh.new()
	var wmat := StandardMaterial3D.new()
	wmat.albedo_color = _accent.darkened(0.3)
	wmat.emission_enabled = true
	wmat.emission = _accent
	wmat.emission_energy_multiplier = 1.5
	wmat.metallic = 0.9
	match kind:
		Kind.GRUNT: wpn.size = Vector3(0.12, 0.1, 0.6)
		Kind.ASSASSIN: wpn.size = Vector3(0.05, 0.04, 0.7)
		_: wpn.size = Vector3(0.12, 0.3, 1.6)
	if not has_model:
		_mesh(_arm, wpn, Vector3(0, 0, -wpn.size.z * 0.5), wmat)
	var glow := OmniLight3D.new()
	glow.light_color = _accent
	glow.light_energy = 0.7
	glow.omni_range = 2.5
	glow.position.y = 1.6
	_rig.add_child(glow)
	# Floating health bar (faces the camera every frame).
	bar_height = 2.15 * sc
	if has_model:
		bar_height = TARGET_HEIGHT[kind] + 0.3
		glow.position.y = TARGET_HEIGHT[kind] * 0.85 / sc  # rig is scaled by sc
	_bar = Node3D.new()
	_bar.position.y = bar_height
	add_child(_bar)
	var q := QuadMesh.new()
	q.size = Vector2(1.0, 0.1)
	var bg := MeshInstance3D.new()
	bg.mesh = q
	bg.material_override = _flat(Color(0, 0, 0, 0.7))
	_bar.add_child(bg)
	_bar_fill = MeshInstance3D.new()
	_bar_fill.mesh = q
	_bar_fill.position.z = 0.005
	_bar_fill.material_override = _flat(_accent if kind == Kind.ELITE else Color(0.85, 0.1, 0.1))
	_bar.add_child(_bar_fill)

func _flat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = c
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.no_depth_test = true
	m.render_priority = 10
	return m

func _pose(arm: Vector3, lean: float, dur: float) -> void:
	if _tween:
		_tween.kill()
	_tween = create_tween().set_parallel(true)
	_tween.tween_property(_arm, "rotation", arm, dur).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_property(_rig, "rotation:x", lean, dur)

# ---------------------------------------------------------------- AI
func _state(s: State, t := 0.0) -> void:
	state = s
	_t = t

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	if state == State.DEAD:
		velocity.x = 0.0
		velocity.z = 0.0
		move_and_slide()
		return
	_t -= delta
	var has_target := target != null and is_instance_valid(target) and not target.health.dead
	var to_p := Vector3.ZERO
	var dist := INF
	if has_target:
		to_p = (target.global_position - global_position) * Vector3(1, 0, 1)
		dist = to_p.length()
	var desired := Vector3.ZERO
	match state:
		State.IDLE, State.PATROL:
			if has_target and dist < detect_radius:
				_state(State.CHASE)
			elif _t <= 0.0:
				if state == State.IDLE:
					_patrol_point = _home + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))
					_state(State.PATROL, 3.0)
				else:
					_state(State.IDLE, randf_range(1.0, 2.0))
			elif state == State.PATROL:
				desired = _nav_dir(_patrol_point, delta) * move_speed * 0.4
				if global_position.distance_to(_patrol_point) < 0.8:
					_state(State.IDLE, 1.5)
		State.CHASE:
			if not has_target or dist > detect_radius * 2.0:
				_home = global_position
				_state(State.IDLE, 1.0)
			elif dist <= attack_range:
				_hits_left = combo_hits
				_begin_windup(attack_windup)
			else:
				var goal := target.global_position
				if flanker and dist > 3.0:
					# Circle toward the player's side instead of approaching head-on.
					var side := to_p.normalized().cross(Vector3.UP) * _flank_side
					goal += side * 3.0
				desired = _nav_dir(goal, delta) * move_speed
		State.ATTACK:
			if has_target and _t > 0.15:
				_face(to_p, 4.0, delta)  # slow tracking during wind-up = dodgeable
			if _t <= 0.0:
				_strike(has_target, to_p, dist)
		State.RECOVER:
			if has_target and dist < 1.2:
				desired = -to_p.normalized() * move_speed * 0.3
			if _t <= 0.0:
				_state(State.CHASE)
		State.STAGGER:
			if _t <= 0.0:
				_pose(ARM_REST, 0.0, 0.2)
				_state(State.RECOVER, 0.4)
	velocity.x = move_toward(velocity.x, desired.x, 30.0 * delta)
	velocity.z = move_toward(velocity.z, desired.z, 30.0 * delta)
	if desired.length() > 0.1:
		_face(desired, 10.0, delta)
	move_and_slide()
	_update_locomotion_anim()

func _process(_delta: float) -> void:
	if _bar.visible and target and is_instance_valid(target):
		_bar.global_basis = target.camera.global_basis

func _face(dir: Vector3, speed: float, delta: float) -> void:
	if dir.length() > 0.01:
		rotation.y = lerp_angle(rotation.y, atan2(-dir.x, -dir.z), speed * delta)

## Returns a flat steering direction toward goal along the navmesh.
func _nav_dir(goal: Vector3, delta: float) -> Vector3:
	_repath -= delta
	if _repath <= 0.0:
		_repath = 0.25
		_agent.target_position = goal
	var next := _agent.get_next_path_position()
	var d := (next - global_position) * Vector3(1, 0, 1)
	if d.length() < 0.15:
		d = (goal - global_position) * Vector3(1, 0, 1)
	return d.normalized() if d.length() > 0.05 else Vector3.ZERO

func _begin_windup(t: float) -> void:
	_state(State.ATTACK, t)
	_eye_mat.emission_energy_multiplier = 12.0  # telegraph
	# Stalker opens a string with a pounce; everyone else uses the attack clip.
	var pounce := kind == Kind.ASSASSIN and _hits_left == combo_hits and _clips.has("pounce")
	_play("pounce" if pounce else "attack", 1.0, true)
	_pose(Vector3(1.8, 0, 0), 0.2, t * 0.8)

func _strike(has_target: bool, to_p: Vector3, dist: float) -> void:
	_eye_mat.emission_energy_multiplier = 4.0
	_pose(Vector3(-1.2, 0, 0), -0.25, 0.1)
	velocity += -global_basis.z * (6.0 if kind == Kind.ASSASSIN else 3.0)
	if kind == Kind.KNIGHT or kind == Kind.ELITE:
		# Ground slam: impact ring at the weapon's landing spot + camera shake.
		FX.shockwave(get_parent(), global_position - global_basis.z * 1.6, 2.2)
		if has_target and dist < 6.0:
			target.shake(0.6)
	if has_target and dist <= attack_range + 0.6:
		var fwd := -global_basis.z
		if dist < 0.8 or fwd.angle_to(to_p.normalized()) < deg_to_rad(75.0):
			if target.health.take_damage(attack_damage, global_position, 1):
				FX.hit_sparks(get_parent(), target.global_position + Vector3(0, 1.1, 0), kind != Kind.GRUNT)
	_hits_left -= 1
	if _hits_left > 0:
		get_tree().create_timer(0.12).timeout.connect(_combo_followup)
		_state(State.ATTACK, 999.0)  # held until follow-up begins
	else:
		_state(State.RECOVER, recover_time)
		get_tree().create_timer(0.25).timeout.connect(_rest_pose)

func _combo_followup() -> void:
	if state == State.ATTACK:
		_begin_windup(combo_windup)

func _rest_pose() -> void:
	if state == State.RECOVER:
		_pose(ARM_REST, 0.0, 0.3)

# ---------------------------------------------------------------- damage
## Called by the player's attacks. Returns true if the hit landed.
func take_hit(amount: float, from: Vector3, stagger_power: int) -> bool:
	if state == State.DEAD:
		return false
	if not health.take_damage(amount, from, stagger_power):
		return false
	FX.damage_number(get_parent(), global_position + Vector3(0, bar_height + 0.2, 0), amount, stagger_power >= 3)
	_bar_fill.scale.x = maxf(health.ratio(), 0.001)
	_bar_fill.position.x = -(1.0 - health.ratio()) * 0.5
	_body_mat.emission = Color(1, 1, 1)
	_body_mat.emission_energy_multiplier = 2.5
	create_tween().tween_property(_body_mat, "emission_energy_multiplier", 0.0, 0.15)
	if _flash_mat:  # additive white flash over the imported model
		_flash_mat.albedo_color.a = 0.7
		create_tween().tween_property(_flash_mat, "albedo_color:a", 0.0, 0.15)
	if state == State.DEAD:
		return true
	var away := (global_position - from) * Vector3(1, 0, 1)
	if away.length() > 0.01:
		velocity += away.normalized() * (1.5 + stagger_power * 1.5)
	_poise_dmg += amount
	if stagger_power >= poise or _poise_dmg >= stagger_threshold:
		_poise_dmg = 0.0
		_eye_mat.emission_energy_multiplier = 4.0
		_state(State.STAGGER, stagger_time if stagger_power >= poise else stagger_time * 1.4)
		_pose(Vector3(0.6, 0, 0.6), 0.45 if _model == null else 0.0, 0.1)
		_play("hit", 1.0, true)
	elif state == State.IDLE or state == State.PATROL:
		_state(State.CHASE)
	return true

func _on_died() -> void:
	_state(State.DEAD)
	remove_from_group("enemies")
	collision_layer = 0
	collision_mask = 1
	_bar.visible = false
	FX.death_burst(get_parent(), global_position + Vector3(0, 1.0, 0))
	died.emit(self)
	if _tween:
		_tween.kill()
	if _model:
		_play("death", 1.0, true)
		var tm := create_tween()
		tm.tween_interval(2.0)
		tm.tween_property(_model, "position:y", -1.5, 1.0)
		tm.tween_callback(queue_free)
		return
	var t := create_tween()
	t.tween_property(_rig, "rotation:x", PI * 0.5, 0.45).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	t.tween_property(_rig, "scale", Vector3(0.01, 0.01, 0.01), 0.6).set_delay(0.4)
	t.tween_callback(queue_free)
