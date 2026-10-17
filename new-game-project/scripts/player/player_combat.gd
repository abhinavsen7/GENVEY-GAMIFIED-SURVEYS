class_name PlayerCombat
extends Node
## Player melee component. Every attack (combo hit, skill step, ultimate cut)
## runs WINDUP -> ACTIVE -> RECOVERY. Damage is decided ONLY by shape/area
## queries during ACTIVE (VFX never decide hits), and every step has its own
## _hit_set so a strike can damage each enemy at most once.
## Multi-hit skills are sequences of steps, each with its own hit window.

signal combo_changed(count: int)
signal special_changed(remaining: float, total: float)
signal skills_changed(text: String)
signal ult_changed(value: float, maximum: float)

@export_group("Light combo / heavy")
@export var light_damage: PackedFloat32Array = [11.0, 13.0, 15.0, 30.0]  ## Cross Slash, Rising Edge, Reaper's Turn, Ashen Breaker
@export var heavy_damage := 45.0
@export_group("Skills")
@export var special_damage := 32.0
@export var special_radius := 6.0
@export var special_cooldown := 8.0
@export var flash_damage := 30.0          ## Crimson Flash
@export var flash_cooldown := 4.0
@export var flash_dash_speed := 22.0
@export var tempest_hit_damage := 9.0     ## Phantom Tempest per cut
@export var tempest_finish_damage := 26.0
@export var tempest_radius := 3.6
@export var tempest_cooldown := 9.0
@export var cleaver_damage := 70.0        ## Heavenfall Cleaver primary
@export var cleaver_area_damage := 30.0
@export var cleaver_radius := 4.5
@export var cleaver_cooldown := 7.0
@export_group("Ultimate")
@export var ult_max := 100.0
@export var ult_gain_per_hit := 3.5
@export var ult_cut_damage := 14.0
@export var ult_final_damage := 90.0
@export var ult_radius := 9.0
@export_group("Feel")
@export var attack_speed := 1.0
@export var combo_reset_time := 0.8
@export var hit_combo_timeout := 2.5
@export var hit_stop_duration := 0.07
@export var effect_intensity := 1.0

enum Phase { NONE, WINDUP, ACTIVE, RECOVERY }

const CRIMSON := Color(1.0, 0.12, 0.12)
const VIOLET := Color(0.65, 0.25, 1.0)
const SILVER := Color(0.9, 0.85, 0.85)
const SFX := preload("res://scripts/audio/sfx.gd")

## Step data. dmg = damage key, area = radius key (hit once at ACTIVE start),
## range/arc = frontal query each ACTIVE frame. All numbers tune feel only.
const ATTACKS := {
	"light0": {"windup": 0.07, "active": 0.11, "recovery": 0.2, "range": 2.6, "arc": 130.0, "lunge": 3.5, "stagger": 1, "dmg": "light0",
		"wind": Vector3(-0.2, -1.6, 0.4), "swing": Vector3(-0.3, 1.6, -0.4), "lean": -0.15, "trail": SILVER, "glow": 1.5},
	"light1": {"windup": 0.08, "active": 0.12, "recovery": 0.22, "range": 2.6, "arc": 120.0, "lunge": 3.5, "stagger": 2, "dmg": "light1",
		"wind": Vector3(-0.9, -1.4, 0.3), "swing": Vector3(1.2, 1.4, -0.3), "lean": -0.1, "trail": CRIMSON, "glow": 1.8},
	"light2": {"windup": 0.08, "active": 0.2, "recovery": 0.24, "range": 2.7, "arc": 360.0, "lunge": 2.0, "stagger": 1, "dmg": "light2",
		"wind": Vector3(-0.1, -1.5, 0.2), "swing": Vector3(-0.1, -1.5, 0.2), "lean": -0.1, "spin": true, "trail": CRIMSON, "after": true, "glow": 2.0},
	"light3": {"windup": 0.18, "active": 0.14, "recovery": 0.4, "range": 2.9, "arc": 100.0, "lunge": 6.0, "stagger": 3, "dmg": "light3",
		"wind": Vector3(2.0, -0.6, 0.3), "swing": Vector3(-1.2, 0.8, -0.3), "lean": -0.4, "hitstop": true, "shake": 0.5, "trail": CRIMSON, "glow": 4.0, "ground": true},
	"heavy": {"windup": 0.45, "active": 0.15, "recovery": 0.55, "range": 3.0, "arc": 150.0, "lunge": 4.0, "stagger": 3, "dmg": "heavy",
		"wind": Vector3(2.4, 0.3, 0.0), "swing": Vector3(-1.3, 0.0, 0.0), "lean": -0.45, "hitstop": true, "shake": 0.7, "trail": CRIMSON, "glow": 3.0, "ground": true},
	"special": {"windup": 0.18, "active": 0.05, "recovery": 0.35, "range": 0.0, "arc": 360.0, "lunge": 0.0, "stagger": 3, "dmg": "special", "area": "special",
		"wind": Vector3(2.2, 0.0, 0.0), "swing": Vector3(-1.4, 0.0, 0.0), "lean": -0.3, "shake": 0.9, "trail": VIOLET, "glow": 3.0},
	"flash": {"windup": 0.12, "active": 0.22, "recovery": 0.3, "range": 2.4, "arc": 160.0, "lunge": -1.0, "stagger": 2, "dmg": "flash",
		"wind": Vector3(-0.2, -1.7, 0.3), "swing": Vector3(-0.3, 1.7, -0.3), "lean": -0.5, "after": true, "trail": CRIMSON, "glow": 5.0, "shake": 0.4},
	"tempest_a": {"windup": 0.05, "active": 0.08, "recovery": 0.04, "range": 0.0, "arc": 360.0, "lunge": 1.0, "stagger": 1, "dmg": "tempest", "area": "tempest",
		"wind": Vector3(-0.2, -1.6, 0.5), "swing": Vector3(0.6, 1.6, -0.5), "lean": -0.2, "after": true, "trail": CRIMSON, "glow": 4.0},
	"tempest_b": {"windup": 0.05, "active": 0.08, "recovery": 0.04, "range": 0.0, "arc": 360.0, "lunge": 1.0, "stagger": 1, "dmg": "tempest", "area": "tempest",
		"wind": Vector3(0.8, 1.6, -0.4), "swing": Vector3(-0.8, -1.6, 0.4), "lean": -0.2, "after": true, "trail": VIOLET, "glow": 4.0},
	"tempest_fin": {"windup": 0.14, "active": 0.12, "recovery": 0.35, "range": 0.0, "arc": 360.0, "lunge": 3.0, "stagger": 3, "dmg": "tempest_fin", "area": "tempest",
		"wind": Vector3(1.8, -1.2, 0.0), "swing": Vector3(-1.2, 1.2, 0.0), "lean": -0.4, "hitstop": true, "shake": 0.7, "trail": CRIMSON, "glow": 6.0, "arc_fx": true},
	"cleaver": {"windup": 0.45, "active": 0.12, "recovery": 0.5, "range": 3.0, "arc": 90.0, "lunge": 2.0, "stagger": 3, "dmg": "cleaver", "area": "cleaver", "area_dmg": "cleaver_area",
		"wind": Vector3(2.6, 0.0, 0.0), "swing": Vector3(-1.4, 0.0, 0.0), "lean": -0.5, "jump": 5.5, "hitstop": true, "shake": 1.1, "trail": CRIMSON, "glow": 7.0, "ground": true},
	"ult_awaken": {"windup": 0.7, "active": 0.02, "recovery": 0.05, "range": 0.0, "arc": 0.0, "lunge": 0.0, "stagger": 0, "dmg": "none",
		"wind": Vector3(-1.2, 0.0, 0.0), "swing": Vector3(-1.2, 0.0, 0.0), "lean": 0.1, "glow": 8.0, "awaken": true},
	"ult_cut_a": {"windup": 0.05, "active": 0.08, "recovery": 0.03, "range": 0.0, "arc": 360.0, "lunge": 4.0, "stagger": 1, "dmg": "ult_cut", "area": "ult_small",
		"wind": Vector3(-0.2, -1.7, 0.5), "swing": Vector3(0.7, 1.7, -0.5), "lean": -0.3, "after": true, "trail": CRIMSON, "glow": 8.0},
	"ult_cut_b": {"windup": 0.05, "active": 0.08, "recovery": 0.03, "range": 0.0, "arc": 360.0, "lunge": 4.0, "stagger": 1, "dmg": "ult_cut", "area": "ult_small",
		"wind": Vector3(0.9, 1.7, -0.5), "swing": Vector3(-0.9, -1.7, 0.5), "lean": -0.3, "after": true, "trail": VIOLET, "glow": 8.0},
	"ult_final": {"windup": 0.3, "active": 0.1, "recovery": 0.5, "range": 0.0, "arc": 360.0, "lunge": 0.0, "stagger": 3, "dmg": "ult_final", "area": "ult",
		"wind": Vector3(2.6, -0.8, 0.0), "swing": Vector3(-1.3, 1.0, 0.0), "lean": -0.5, "hitstop": true, "shake": 1.6, "trail": CRIMSON, "glow": 10.0, "arc_fx": true, "ground": true},
}
const REST_ARM := Vector3(-0.8, 0.25, 0.0)
const TEMPEST_SEQ := ["tempest_b", "tempest_a", "tempest_b", "tempest_fin"]
const ULT_SEQ := ["ult_cut_a", "ult_cut_b", "ult_cut_a", "ult_cut_b", "ult_cut_a", "ult_cut_b", "ult_final"]

var player: CharacterBody3D
var hit_combo := 0
var weapon_mult := 1.0
var temp_mult := 1.0
var weapon_name := "Ashen Edge"
var owned_weapons: Array[String] = []
var ult := 0.0
var ult_active := false
var _atk: Dictionary = {}
var _atk_name := ""
var _phase := Phase.NONE
var _phase_t := 0.0
var _chain := 0
var _idle_t := 0.0
var _queued := ""
var _sequence: Array = []
var _combo_t := 0.0
var _special_cd := 0.0
var _cds := {"flash": 0.0, "tempest": 0.0, "cleaver": 0.0}
var _ui_t := 0.0
var _ghost_t := 0.0
var _hit_set: Array[Node] = []
var _query := PhysicsShapeQueryParameters3D.new()
var _sphere := SphereShape3D.new()
var _tween: Tween

func _ready() -> void:
	player = get_parent() as CharacterBody3D
	_query.shape = _sphere
	_query.collision_mask = 4  # enemies only: pickups and world are never hit
	_query.collide_with_areas = false

func is_busy() -> bool:
	return _phase != Phase.NONE

func current_lunge() -> float:
	if _phase != Phase.ACTIVE:
		return 0.0
	var l: float = _atk.get("lunge", 0.0)
	return flash_dash_speed if l < 0.0 else l

func cancel() -> void:
	_phase = Phase.NONE
	_queued = ""
	_sequence.clear()
	player.trail.emitting = false
	if player and player.rig:
		player.rig.rotation.y = 0.0
		player.rig.rotation.x = 0.0
		player.rig.rotation.z = 0.0
	if _tween:
		_tween.kill()
	if player and player.arm_pivot:
		player.arm_pivot.rotation = Vector3.ZERO if (player.hero and player.hero.has_skeleton()) else REST_ARM
	player.set_blade_glow(0.8)
	if ult_active:
		_end_ult()

func damage_multiplier() -> float:
	return weapon_mult * temp_mult

func special_ready() -> bool:
	return _special_cd <= 0.0

func restore_energy(fraction: float) -> void:
	_special_cd = maxf(_special_cd - special_cooldown * fraction, 0.0)
	special_changed.emit(_special_cd, special_cooldown)

func _physics_process(delta: float) -> void:
	_tick_cooldowns(delta)
	if hit_combo > 0:
		_combo_t -= delta
		if _combo_t <= 0.0:
			hit_combo = 0
			combo_changed.emit(0)
	if player.health.dead or not player.input_enabled:
		if is_busy():
			cancel()  # death/victory/survey always take priority
		return
	_read_input()
	if _phase == Phase.NONE:
		_idle_t += delta
		if _idle_t > combo_reset_time:
			_chain = 0
		return
	_phase_t -= delta
	if _phase == Phase.ACTIVE:
		if _atk.range > 0.0:
			_do_hits()
		if _atk.get("after", false):
			_ghost_t -= delta
			if _ghost_t <= 0.0:
				_ghost_t = 0.06
				FX.afterimage(player.get_parent(), player.global_transform, _atk.get("trail", CRIMSON))
	if _phase == Phase.RECOVERY and _sequence.is_empty() and _queued != "" and _phase_t < _atk.recovery * 0.6 / attack_speed:
		_start(_queued)
		return
	if _phase_t <= 0.0:
		_advance()

func _tick_cooldowns(delta: float) -> void:
	if _special_cd > 0.0:
		_special_cd = maxf(_special_cd - delta, 0.0)
		special_changed.emit(_special_cd, special_cooldown)
	for k in _cds:
		_cds[k] = maxf(_cds[k] - delta, 0.0)
	_ui_t -= delta
	if _ui_t <= 0.0:  # HUD text refresh at 10 Hz, not every frame
		_ui_t = 0.1
		skills_changed.emit("[1] Crimson Flash %s   [2] Phantom Tempest %s   [3] Heavenfall Cleaver %s" % [_cd_text("flash"), _cd_text("tempest"), _cd_text("cleaver")])

func _cd_text(k: String) -> String:
	return "READY" if _cds[k] <= 0.0 else "%.1fs" % _cds[k]

func _read_input() -> void:
	var want := ""
	if Input.is_action_just_pressed("ultimate") and ult >= ult_max and not ult_active:
		_start_ult()
		return
	if Input.is_action_just_pressed("light_attack"):
		want = "light"
	elif Input.is_action_just_pressed("heavy_attack"):
		want = "heavy"
	elif Input.is_action_just_pressed("special") and _special_cd <= 0.0:
		want = "special"
	elif Input.is_action_just_pressed("skill_flash") and _cds.flash <= 0.0:
		want = "flash"
	elif Input.is_action_just_pressed("skill_tempest") and _cds.tempest <= 0.0:
		want = "tempest"
	elif Input.is_action_just_pressed("skill_cleaver") and _cds.cleaver <= 0.0:
		want = "cleaver"
	if want == "" or ult_active:
		return
	if _phase == Phase.NONE:
		if not player.is_dodging():
			_start(want)
	elif _sequence.is_empty():
		_queued = want  # input buffer

func _start(kind: String) -> void:
	_queued = ""
	_sequence.clear()
	var step := kind
	match kind:
		"light":
			step = "light%d" % _chain
			_chain = (_chain + 1) % 4
		"special":
			_special_cd = special_cooldown
			special_changed.emit(_special_cd, special_cooldown)
		"flash", "tempest", "cleaver":
			if _cds[kind] > 0.0:
				return
			_cds[kind] = {"flash": flash_cooldown, "tempest": tempest_cooldown, "cleaver": cleaver_cooldown}[kind]
			if kind == "tempest":
				step = "tempest_a"
				_sequence = TEMPEST_SEQ.duplicate()
	if kind != "light":
		_chain = 0
	player.face_attack_direction()
	_begin(step)

func _start_ult() -> void:
	if _phase != Phase.NONE and _phase != Phase.RECOVERY:
		return
	ult = 0.0  # consumed exactly once, before anything else can run
	ult_changed.emit(ult, ult_max)
	ult_active = true
	player.health.invulnerable = true
	_queued = ""
	player.face_attack_direction()
	_sequence = ULT_SEQ.duplicate()
	_begin("ult_awaken")

func _end_ult() -> void:
	ult_active = false
	if not player.is_dodging():
		player.health.invulnerable = false
	player.set_blade_glow(0.8)

func _begin(step: String) -> void:
	_atk_name = step
	_atk = ATTACKS[step]
	_hit_set.clear()
	_phase = Phase.WINDUP
	_phase_t = _atk.windup / attack_speed
	_pose(_atk.wind, 0.15 if step in ["heavy", "cleaver"] else -0.05, _phase_t)
	if player and player.hero and player.hero.has_method("play_action"):
		var clip_name := "Judgment" if step in ["heavy", "cleaver", "ult_final"] else "Attack"
		player.hero.play_action(clip_name, 0.06)
	player.set_blade_glow(_atk.get("glow", 1.0) * effect_intensity)
	if _atk.has("jump"):
		player.velocity.y = _atk.jump
	if _atk.get("awaken", false):
		FX.shockwave(player.get_parent(), player.global_position, 1.6, CRIMSON)
		FX.death_burst(player.get_parent(), player.global_position + Vector3(0, 1, 0))

func _advance() -> void:
	match _phase:
		Phase.WINDUP:
			_phase = Phase.ACTIVE
			_phase_t = _atk.active / attack_speed
			player.set_trail(_atk.get("trail", SILVER), (_atk.get("glow", 1.0) + 2.0) * effect_intensity)
			player.trail.emitting = _atk.has("trail")
			if _atk_name == "flash":
				SFX.flash(player)
			elif _atk.get("ground", false) or _atk_name == "special":
				SFX.shockwave(player, player.global_position)
			elif _atk.has("trail"):
				SFX.swing(player, 1.0 + _chain * 0.08)
			_pose(_atk.swing, _atk.lean, _phase_t)
			if _atk.get("spin", false) and player and player.rig:
				player.rig.rotation.x = 0.0
				player.rig.rotation.z = 0.0
				player.rig.rotation.y = 0.0
				player.create_tween().tween_property(player.rig, "rotation:y", -TAU, _phase_t)
			if _atk.range > 0.0:
				_do_hits()
			if _atk.has("area"):
				_area_hit(_radius(_atk.area), _atk.get("area_dmg", _atk.dmg))
			if _atk.get("arc_fx", false):
				FX.crimson_arc(player.get_parent(), player.global_position, player.visual.rotation.y, _radius(_atk.get("area", "tempest")))
			if _atk.get("ground", false):
				var p: Vector3 = player.global_position + Vector3(player.forward()) * 1.8
				FX.shockwave(player.get_parent(), p, 1.5 + _radius(_atk.get("area", "none")) * 0.5, Color(1.0, 0.35, 0.15))
				FX.hit_sparks(player.get_parent(), p + Vector3(0, 0.2, 0), true)
		Phase.ACTIVE:
			_phase = Phase.RECOVERY
			_phase_t = _atk.recovery / attack_speed
			player.trail.emitting = false
			if player and player.rig:
				player.rig.rotation.y = 0.0
				player.rig.rotation.x = 0.0
				player.rig.rotation.z = 0.0
			_pose(REST_ARM, 0.0, _phase_t)
		Phase.RECOVERY:
			_phase = Phase.NONE
			_idle_t = 0.0
			if not _sequence.is_empty():
				_begin(_sequence.pop_front())
				return
			player.set_blade_glow(0.8)
			if ult_active:
				_end_ult()
			if _queued != "":
				_start(_queued)

func _pose(arm: Vector3, _lean: float, dur: float) -> void:
	if _tween:
		_tween.kill()
	if player.hero == null or not player.hero.has_skeleton():
		_tween = player.create_tween().set_parallel(true)
		_tween.tween_property(player.arm_pivot, "rotation", arm, maxf(dur, 0.01)).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	else:
		player.arm_pivot.rotation = Vector3.ZERO
	if player and player.rig:
		player.rig.rotation.x = 0.0
		player.rig.rotation.z = 0.0

func _radius(key: String) -> float:
	match key:
		"special": return special_radius
		"tempest": return tempest_radius
		"cleaver": return cleaver_radius
		"ult": return ult_radius
		"ult_small": return ult_radius * 0.6
	return 0.0

func _damage_for(key: String) -> float:
	match key:
		"light0": return light_damage[0]
		"light1": return light_damage[1]
		"light2": return light_damage[2]
		"light3": return light_damage[3]
		"heavy": return heavy_damage
		"special": return special_damage
		"flash": return flash_damage
		"tempest": return tempest_hit_damage
		"tempest_fin": return tempest_finish_damage
		"cleaver": return cleaver_damage
		"cleaver_area": return cleaver_area_damage
		"ult_cut": return ult_cut_damage
		"ult_final": return ult_final_damage
	return 0.0

## Frontal sphere query in front of the blade, filtered by the attack arc.
func _do_hits() -> void:
	var rng: float = _atk.range
	var fwd: Vector3 = player.forward()
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
		_land_hit(e, _damage_for(_atk.dmg))

## One-shot radial hit around the player (skills / ultimate).
func _area_hit(radius: float, dmg_key: String) -> void:
	if radius <= 0.0:
		return
	if _atk_name == "special":
		FX.shockwave(player.get_parent(), player.global_position, special_radius)
	for e in player.get_tree().get_nodes_in_group("enemies"):
		if e.is_dead() or _hit_set.has(e):
			continue
		if e.global_position.distance_to(player.global_position) <= radius:
			_hit_set.append(e)
			_land_hit(e, _damage_for(dmg_key))

func _land_hit(e: Enemy, dmg: float) -> void:
	if dmg <= 0.0:
		return
	dmg *= damage_multiplier()
	var heavy: bool = _atk.get("hitstop", false)
	if not e.take_hit(dmg, player.global_position, _atk.stagger):
		return
	# Sparks at the contact point: enemy surface facing the player.
	var dir := (player.global_position - e.global_position) * Vector3(1, 0, 1)
	var contact := e.global_position + Vector3(0, 1.1, 0) + (dir.normalized() * 0.5 if dir.length() > 0.01 else Vector3.ZERO)
	SFX.hit(player, contact, heavy)
	FX.hit_sparks(player.get_parent(), contact, heavy)
	hit_combo += 1
	_combo_t = hit_combo_timeout
	combo_changed.emit(hit_combo)
	if not ult_active:
		ult = minf(ult + ult_gain_per_hit * (2.0 if heavy else 1.0), ult_max)
		ult_changed.emit(ult, ult_max)
	player.shake(_atk.get("shake", 0.25))
	if heavy:
		FX.hit_stop(player.get_tree(), hit_stop_duration * (1.8 if _atk_name == "ult_final" else 1.0))
