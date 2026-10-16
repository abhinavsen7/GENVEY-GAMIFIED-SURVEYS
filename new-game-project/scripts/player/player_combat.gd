class_name PlayerCombat
extends Node
## Player melee component. Every attack runs WINDUP -> ACTIVE -> RECOVERY.
## Hits are detected only during ACTIVE with a sphere shape query on the enemy
## layer, and each enemy can be hit once per swing (tracked in _hit_set).
## Inputs pressed during an attack are buffered to chain the combo.

signal combo_changed(count: int)
signal special_changed(remaining: float, total: float)

@export var light_damage: PackedFloat32Array = [12.0, 15.0, 26.0]
@export var heavy_damage := 45.0
@export var special_damage := 32.0
@export var special_radius := 6.0
@export var special_cooldown := 8.0
@export var attack_speed := 1.0          ## multiplier on all attack timings
@export var combo_reset_time := 0.8      ## idle time before light chain restarts
@export var hit_combo_timeout := 2.5     ## HUD combo counter decay

enum Phase { NONE, WINDUP, ACTIVE, RECOVERY }

# Timing/shape data per attack. damage comes from the exports above.
const ATTACKS := {
	"light0": {"windup": 0.08, "active": 0.12, "recovery": 0.22, "range": 2.4, "arc": 130.0, "lunge": 3.5, "stagger": 1,
		"wind": Vector3(-0.2, -1.6, 0.4), "swing": Vector3(-0.3, 1.6, -0.4), "lean": -0.15},
	"light1": {"windup": 0.08, "active": 0.12, "recovery": 0.22, "range": 2.4, "arc": 130.0, "lunge": 3.5, "stagger": 1,
		"wind": Vector3(-0.2, 1.7, -0.4), "swing": Vector3(-0.3, -1.5, 0.4), "lean": -0.15},
	"light2": {"windup": 0.14, "active": 0.14, "recovery": 0.38, "range": 2.7, "arc": 90.0, "lunge": 6.0, "stagger": 2,
		"wind": Vector3(1.9, 0.0, 0.0), "swing": Vector3(-1.2, 0.0, 0.0), "lean": -0.35, "hitstop": true},
	"heavy": {"windup": 0.45, "active": 0.15, "recovery": 0.55, "range": 3.0, "arc": 150.0, "lunge": 4.0, "stagger": 3,
		"wind": Vector3(2.4, 0.3, 0.0), "swing": Vector3(-1.3, 0.0, 0.0), "lean": -0.45, "hitstop": true, "shake": 0.7},
	"special": {"windup": 0.18, "active": 0.05, "recovery": 0.35, "range": 0.0, "arc": 360.0, "lunge": 0.0, "stagger": 3,
		"wind": Vector3(2.2, 0.0, 0.0), "swing": Vector3(-1.4, 0.0, 0.0), "lean": -0.3, "shake": 0.9},
}

var player: Player
var hit_combo := 0
var weapon_mult := 1.0
var temp_mult := 1.0
var weapon_name := "Temple Sword"
var owned_weapons: Array[String] = []
var _atk: Dictionary = {}
var _atk_name := ""
var _phase := Phase.NONE
var _phase_t := 0.0
var _chain := 0
var _idle_t := 0.0
var _queued := ""
var _combo_t := 0.0
var _special_cd := 0.0
var _hit_set: Array[Node] = []
var _query := PhysicsShapeQueryParameters3D.new()
var _sphere := SphereShape3D.new()
var _tween: Tween

func _ready() -> void:
	player = get_parent() as Player
	_query.shape = _sphere
	_query.collision_mask = 4
	_query.collide_with_areas = false

func is_busy() -> bool:
	return _phase != Phase.NONE

func current_lunge() -> float:
	return _atk.get("lunge", 0.0) if _phase == Phase.ACTIVE else 0.0

func cancel() -> void:
	_phase = Phase.NONE
	_queued = ""
	player.trail.emitting = false

func _physics_process(delta: float) -> void:
	if _special_cd > 0.0:
		_special_cd = maxf(_special_cd - delta, 0.0)
		special_changed.emit(_special_cd, special_cooldown)
	if hit_combo > 0:
		_combo_t -= delta
		if _combo_t <= 0.0:
			hit_combo = 0
			combo_changed.emit(0)
	if player.health.dead or not player.input_enabled:
		return
	_read_input()
	if _phase == Phase.NONE:
		_idle_t += delta
		if _idle_t > combo_reset_time:
			_chain = 0
		return
	_phase_t -= delta
	if _phase == Phase.ACTIVE and _atk_name != "special":
		_do_hits()
	# Buffered input can cancel the late part of recovery for snappy chains.
	if _phase == Phase.RECOVERY and _queued != "" and _phase_t < _atk.recovery * 0.6 / attack_speed:
		_start(_queued)
		return
	if _phase_t <= 0.0:
		_advance()

func _read_input() -> void:
	var want := ""
	if Input.is_action_just_pressed("light_attack"):
		want = "light"
	elif Input.is_action_just_pressed("heavy_attack"):
		want = "heavy"
	elif Input.is_action_just_pressed("special") and _special_cd <= 0.0:
		want = "special"
	if want == "":
		return
	if _phase == Phase.NONE:
		if not player.is_dodging():
			_start(want)
	elif want != "special":
		_queued = want

func _start(kind: String) -> void:
	_queued = ""
	if kind == "light":
		_atk_name = "light%d" % _chain
		_chain = (_chain + 1) % 3
	else:
		_atk_name = kind
		_chain = 0
	if kind == "special":
		_special_cd = special_cooldown
		special_changed.emit(_special_cd, special_cooldown)
	_atk = ATTACKS[_atk_name]
	_hit_set.clear()
	player.face_attack_direction()
	_phase = Phase.WINDUP
	_phase_t = _atk.windup / attack_speed
	_pose(_atk.wind, 0.15 if kind == "heavy" else -0.05, _phase_t)

func _advance() -> void:
	match _phase:
		Phase.WINDUP:
			_phase = Phase.ACTIVE
			_phase_t = _atk.active / attack_speed
			player.trail.emitting = true
			_pose(_atk.swing, _atk.lean, _phase_t)
			if _atk_name == "special":
				_do_special()
		Phase.ACTIVE:
			_phase = Phase.RECOVERY
			_phase_t = _atk.recovery / attack_speed
			player.trail.emitting = false
			_pose(Player.REST_ARM, 0.0, _phase_t)
		Phase.RECOVERY:
			_phase = Phase.NONE
			_idle_t = 0.0
			if _queued != "":
				_start(_queued)

## Procedural animation: tween the sword arm and body lean to a pose.
func _pose(arm: Vector3, lean: float, dur: float) -> void:
	if _tween:
		_tween.kill()
	_tween = player.create_tween().set_parallel(true)
	_tween.tween_property(player.arm_pivot, "rotation", arm, maxf(dur, 0.01)).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_property(player.rig, "rotation:x", lean, maxf(dur, 0.01))

func _damage_for(name_: String) -> float:
	match name_:
		"light0": return light_damage[0]
		"light1": return light_damage[1]
		"light2": return light_damage[2]
		"heavy": return heavy_damage
	return special_damage

func _do_hits() -> void:
	var rng: float = _atk.range
	var fwd := player.forward()
	_sphere.radius = rng * 0.6
	_query.transform = Transform3D(Basis.IDENTITY, player.global_position + Vector3.UP + fwd * rng * 0.5)
	var results := player.get_world_3d().direct_space_state.intersect_shape(_query, 16)
	var half_arc := deg_to_rad(_atk.arc * 0.5)
	for r in results:
		var e := r.collider as Enemy
		if e == null or e.is_dead() or _hit_set.has(e):
			continue
		var to := (e.global_position - player.global_position) * Vector3(1, 0, 1)
		if to.length() > 0.8 and fwd.angle_to(to.normalized()) > half_arc:
			continue
		_hit_set.append(e)
		_land_hit(e, _damage_for(_atk_name))

func _do_special() -> void:
	FX.shockwave(player.get_parent(), player.global_position, special_radius)
	for e in player.get_tree().get_nodes_in_group("enemies"):
		if not e.is_dead() and e.global_position.distance_to(player.global_position) <= special_radius:
			_land_hit(e, special_damage)

## Permanent weapon upgrades multiply into weapon_mult; survey Damage Boost
## sets temp_mult for one wave (Game resets it when that wave is cleared).
func damage_multiplier() -> float:
	return weapon_mult * temp_mult

func special_ready() -> bool:
	return _special_cd <= 0.0

## Fraction 1.0 = fully recharge the shockwave.
func restore_energy(fraction: float) -> void:
	_special_cd = maxf(_special_cd - special_cooldown * fraction, 0.0)
	special_changed.emit(_special_cd, special_cooldown)

func _land_hit(e: Enemy, dmg: float) -> void:
	dmg *= damage_multiplier()
	var heavy: bool = _atk.get("hitstop", false)
	if not e.take_hit(dmg, player.global_position, _atk.stagger):
		return
	FX.hit_sparks(player.get_parent(), e.global_position + Vector3(0, 1.1, 0), heavy)
	hit_combo += 1
	_combo_t = hit_combo_timeout
	combo_changed.emit(hit_combo)
	if _atk.has("shake"):
		player.shake(_atk.shake)
	else:
		player.shake(0.25)
	if heavy:
		FX.hit_stop(player.get_tree(), 0.07)
