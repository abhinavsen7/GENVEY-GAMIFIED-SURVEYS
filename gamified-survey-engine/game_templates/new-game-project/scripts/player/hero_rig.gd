class_name HeroRig
extends Node
## Hero visual rig: imported mesh, REAL clip-driven locomotion and dodge roll,
## a two-handed greatsword grip solved with analytic two-bone IK, and foot
## contact correction.
##
## OWNERSHIP SPLIT (important)
## Player and PlayerCombat keep owning the ROOT transforms:
##   `rig`       - forward lean, Reaper's Turn spin
##   `arm_pivot` - the swing pose PlayerCombat tweens during attacks
## This node only ever writes SKELETON bone poses, so the two systems never
## fight over the same transform. The single exception is `rig.position.y`,
## which foot contact owns (Player must not bob it).
##
## ANIMATION SOURCES
## Primary locomotion, sprint, jump, roll, and hit/death cycles are retargeted
## from the official Universal Animation Library by Quaternius (CC0).
## Additional combat strikes (Attack, Combo) come from the Gothic Swordsman body.
## All looping locomotion clips are configured with LOOP_LINEAR for seamless cycles.

# --- the hero body ------------------------------------------------------
const HERO_RIG := preload("res://characters/universal_base_characters/hero_male/Superhero_Male_FullBody.gltf")

# --- clip donors (retargeted by bone name) ------------------------------
const SRC_UAL := preload("res://characters/universal_animation_library/universal_animations.glb")
const SRC_MERCENARY := preload("res://characters/mercenary_ef761979/rig.glb")

# Library names we resolve everything through. Nothing else is ever played.
const C_IDLE := "Idle"
const C_IDLE_COMBAT := "Sword_Idle"
const C_WALK := "Walk"
const C_RUN := "Run"
const C_SPRINT := "Sprint"
const C_JUMP_START := "Jump_Start"
const C_JUMP_LOOP := "Jump"
const C_JUMP_LAND := "Jump_Land"
const C_ROLL := "Roll"
const C_ATTACK := "Attack"
const C_ATTACK_SLASH := "Attack_Slash"
const C_ATTACK_THRUST := "Attack_Thrust"
const C_ATTACK_SPIN := "Attack_Spin"
const C_ATTACK_SLAM := "Attack_Slam"
const C_ATTACK_HEAVY := "Attack_Heavy"
const C_ATTACK_CLEAVER := "Attack_Cleaver"
const C_ATTACK_FLASH := "Attack_Flash"
const C_JUDGMENT := "Judgment"
const C_HIT := "Hit"
const C_DEATH := "Death"

# Semantic bone aliases for cross-rig retargeting (Rigify, UAL, Mixamo, VRM, UBC)
const BONE_ALIASES := {
	"defhips": "pelvis",
	"hips": "pelvis",
	"root": "root",
	"defspine001": "spine_01",
	"defspine002": "spine_02",
	"defspine003": "spine_03",
	"spine": "spine_01",
	"spine1": "spine_01",
	"spine2": "spine_02",
	"spine3": "spine_03",
	"chest": "spine_02",
	"upperchest": "spine_03",
	"defneck": "neck_01",
	"neck": "neck_01",
	"defhead": "Head",
	"head": "Head",
	"defshoulderl": "clavicle_l",
	"defupperarml": "upperarm_l",
	"defforearml": "lowerarm_l",
	"defhandl": "hand_l",
	"leftshoulder": "clavicle_l",
	"leftarm": "upperarm_l",
	"leftforearm": "lowerarm_l",
	"lefthand": "hand_l",
	"leftupperarm": "upperarm_l",
	"leftlowerarm": "lowerarm_l",
	"defshoulderr": "clavicle_r",
	"defupperarmr": "upperarm_r",
	"defforearmr": "lowerarm_r",
	"defhandr": "hand_r",
	"rightshoulder": "clavicle_r",
	"rightarm": "upperarm_r",
	"rightforearm": "lowerarm_r",
	"righthand": "hand_r",
	"rightupperarm": "upperarm_r",
	"rightlowerarm": "lowerarm_r",
	"defthighl": "thigh_l",
	"defshinl": "calf_l",
	"deffootl": "foot_l",
	"deftoel": "ball_l",
	"leftupleg": "thigh_l",
	"leftleg": "calf_l",
	"leftfoot": "foot_l",
	"lefttoebase": "ball_l",
	"leftupperleg": "thigh_l",
	"leftlowerleg": "calf_l",
	"defthighr": "thigh_r",
	"defshinr": "calf_r",
	"deffootr": "foot_r",
	"deftoer": "ball_r",
	"rightupleg": "thigh_r",
	"rightleg": "calf_r",
	"rightfoot": "foot_r",
	"righttoebase": "ball_r",
	"rightupperleg": "thigh_r",
	"rightlowerleg": "calf_r",
	"deffindex01l": "index_01_l", "deffindex02l": "index_02_l", "deffindex03l": "index_03_l",
	"deffmiddle01l": "middle_01_l", "deffmiddle02l": "middle_02_l", "deffmiddle03l": "middle_03_l",
	"deffpinky01l": "pinky_01_l", "deffpinky02l": "pinky_02_l", "deffpinky03l": "pinky_03_l",
	"deffring01l": "ring_01_l", "deffring02l": "ring_02_l", "deffring03l": "ring_03_l",
	"defthumb01l": "thumb_01_l", "defthumb02l": "thumb_02_l", "defthumb03l": "thumb_03_l",
	"deffindex01r": "index_01_r", "deffindex02r": "index_02_r", "deffindex03r": "index_03_r",
	"deffmiddle01r": "middle_01_r", "deffmiddle02r": "middle_02_r", "deffmiddle03r": "middle_03_r",
	"deffpinky01r": "pinky_01_r", "deffpinky02r": "pinky_02_r", "deffpinky03r": "pinky_03_r",
	"deffring01r": "ring_01_r", "deffring02r": "ring_02_r", "deffring03r": "ring_03_r",
	"defthumb01r": "thumb_01_r", "defthumb02r": "thumb_02_r", "defthumb03r": "thumb_03_r",
}

@export_group("Placement")
## The source mesh faces +Z; the engine's forward is -Z.
@export var model_yaw := PI
## Extra vertical nudge if the feet do not sit exactly on the ground.
@export var model_y_offset := -0.015

@export_group("Locomotion")
## Clip rate is matched to real ground speed so the feet do not slide.
@export var match_clip_to_player_speed := true
@export var walk_clip_speed := 2.0
@export var run_clip_speed := 4.8
@export var sprint_clip_speed := 7.0
## Speed at which playback switches from Walk to Run.
@export var run_threshold := 3.5
## Speed at which playback switches from Run to Sprint.
@export var sprint_threshold := 5.8
## Fallback only, for when no Idle clip could be retargeted.
@export var idle_clip_speed := 0.18
@export var clip_blend := 0.20
## Roll blends in fast so the dodge feels responsive.
@export var roll_blend := 0.08
## Below this dot(velocity, facing) the clip plays in reverse (backpedal).
@export var backpedal_dot := -0.45

@export_group("Stance")
## Both authored in character-local space; +X is the sword-hand side.
@export var combat_grip := Vector3(0.06, 0.96, -0.28)
@export var combat_blade := Vector3(-0.30, 0.50, -0.81)
@export var relaxed_grip := Vector3(0.22, 0.88, -0.16)
@export var relaxed_blade := Vector3(0.12, 0.48, -0.87)
## How far down the handle the supporting hand sits, toward the pommel.
@export var handle_span := 0.15
## Distance at which an enemy pulls the hero into the combat guard.
@export var alert_range := 11.0
@export var stance_blend := 3.0
## Amplitude of breathing and small weight shifts. Keep subtle.
@export var breathing := 0.008
@export var elbow_pole := Vector3(0.6, -0.20, 0.70)
@export var hand_rot_right := Vector3.ZERO
@export var hand_rot_left := Vector3.ZERO
## false keeps the wrist orientation the clip authored (no broken wrists);
## true forces the palm onto the weapon basis (tighter wrap, may twist).
@export var force_hand_basis := true
## How much of the swing is transferred into torso rotation.
@export var swing_torso := 0.45
## Fallback only, used when the arm chain cannot be identified by name.
@export var fallback_grip := Vector3(0, 0, 0.05)

var visual: Node3D
var rig: Node3D
var arm_pivot: Node3D
var hand_attach: Node3D
var weapon_socket: Node3D = null

var _player: Node
var _rest_arm := Vector3.ZERO
var _rest_basis := Basis.IDENTITY

var _model: Node3D
var _sk: Skeleton3D
var _anim: AnimationPlayer
var _sk_rel := ""
var _meshes: Array[MeshInstance3D] = []
var _clips := {}            ## library name -> true, for cheap has-clip checks

var _arm_r: Array = []
var _arm_l: Array = []
var _hand_r := -1
var _hips := -1
var _spine := -1
var _chest := -1
var _ik_ready := false
var _ik_on := true
var _mirror := 1.0
var _left_pivot: Node3D   ## off-hand blade for Dual Blades

var _stance := 1.0
var _lean := 0.0
var _bank := 0.0
var _prev_yaw := 0.0
var _prev_speed := 0.0
var _flinch := 0.0
var _t := 0.0
var _rolling := false
var _roll_timer := 0.0
var _was_on_floor := true
var _land_timer := 0.0
var _jump_startup := false
var _flash_mat: StandardMaterial3D
var _base_y := 0.9          ## rig's resting hip height above the feet
var _rest_root_y := 0.0     ## root-bone height in the idle pose, the ground ref
var _has_rest := false

# ------------------------------------------------------------------ setup
func setup(player_ref: Node, visual_node: Node3D, rig_node: Node3D, pivot: Node3D, attach: Node3D, rest_arm: Vector3) -> void:
	_player = player_ref
	visual = visual_node
	rig = rig_node
	arm_pivot = pivot
	hand_attach = attach
	_rest_arm = rest_arm
	_rest_basis = arm_pivot.basis
	_base_y = rig.position.y
	_build_model()
	_build_flash()

func _build_model() -> void:
	_model = HERO_RIG.instantiate()
	_model.rotation.y = model_yaw
	# rig sits at hip height; drop the model so its origin (the feet) is at y=0.
	_model.position = Vector3(0, -rig.position.y + model_y_offset, 0)
	rig.add_child(_model)
	_sk = _find_skeleton(_model)
	_collect_meshes(_model)
	_build_clips()
	if _sk == null:
		push_warning("[HeroRig] no Skeleton3D found in the hero model")
		return
	_hand_r = _find_bone(["hand"], true, _FINGER)
	_hips = _find_bone(["hips", "pelvis"], true, _FINGER)
	_spine = _find_bone(["spine"], true, _FINGER)
	_chest = _find_bone(["chest", "spine03", "spine02", "spine3", "spine2", "upperchest"], true, _FINGER)
	_arm_r = _find_chain(true)
	_arm_l = _find_chain(false)
	if _hand_r >= 0 and visual:
		# Which side of the character does the sword hand actually sit on?
		_mirror = 1.0 if visual.to_local(_bone_world(_hand_r).origin).x >= 0.0 else -1.0
	_ik_ready = _arm_r.size() == 5
	if _sk:
		_build_hero_outfit()
		var bone_attach := BoneAttachment3D.new()
		bone_attach.name = "RightHandAttachment"
		_sk.add_child(bone_attach)
		bone_attach.bone_name = "hand_r"
		bone_attach.bone_idx = _sk.find_bone("hand_r")
		
		weapon_socket = Node3D.new()
		weapon_socket.name = "WeaponSocket"
		weapon_socket.position = Vector3(0.0, 0.02, 0.035)
		weapon_socket.rotation_degrees = Vector3(-45.0, 165.0, -180.0)
		bone_attach.add_child(weapon_socket)
	_diagnose()

func get_weapon_socket() -> Node3D:
	return weapon_socket

const _FINGER := ["finger", "thumb", "index", "pinky", "ring", "middle", "clavicle", "shoulder", "neck", "head"]

## One startup line listing the bones and the clips we actually resolved. Cheap,
## and it makes a mis-named rig or a rejected clip obvious instead of silently
## leaving the character unposed.
func _diagnose() -> void:
	var names := PackedStringArray()
	if _sk:
		for i in _sk.get_bone_count():
			names.append(_sk.get_bone_name(i))
	print("[HeroRig] bones=", names)
	print("[HeroRig] ik_right=", _arm_r, " ik_left=", _arm_l, " mirror=", _mirror)
	print("[HeroRig] clips=", _clips.keys())

func _find_skeleton(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var f := _find_skeleton(c)
		if f:
			return f
	return null

func _collect_meshes(n: Node) -> void:
	if n is MeshInstance3D:
		_meshes.append(n)
	for c in n.get_children():
		_collect_meshes(c)

func _norm(s: String) -> String:
	return s.to_lower().replace("mixamorig", "").replace("_", "").replace(".", "").replace("-", "").replace(":", "")

func _side(n: String) -> int:
	if n.contains("left") or n.ends_with("l") or n.contains("_l") or n.contains(".l"):
		return -1
	if n.contains("right") or n.ends_with("r") or n.contains("_r") or n.contains(".r"):
		return 1
	return 0

## Finds a bone by name fragment, preferring the requested side. Returns -1 if
## nothing matches, so every caller must handle a missing rig gracefully.
func _find_bone(keys: Array, right: bool, exclude: Array) -> int:
	if _sk == null:
		return -1
	var want := 1 if right else -1
	var loose := -1
	for i in _sk.get_bone_count():
		var n := _norm(_sk.get_bone_name(i))
		var hit := false
		for k in keys:
			if n.contains(k):
				hit = true
				break
		if not hit:
			continue
		var bad := false
		for e in exclude:
			if n.contains(e):
				bad = true
				break
		if bad:
			continue
		var s := _side(n)
		if s == want:
			return i
		if s == 0 and loose < 0:
			loose = i
	return loose

## [upper_arm, lower_arm, hand, upper_length, lower_length] or [] when the rig
## does not follow a recognisable humanoid naming scheme.
func _find_chain(right: bool) -> Array:
	var upper := _find_bone(["upperarm", "arm"], right, _FINGER + ["forearm", "lowerarm"])
	var lower := _find_bone(["forearm", "lowerarm"], right, _FINGER)
	var hand := _find_bone(["hand"], right, _FINGER)
	if upper < 0 or lower < 0 or hand < 0:
		return []
	var l1 := _sk.get_bone_rest(lower).origin.length()
	var l2 := _sk.get_bone_rest(hand).origin.length()
	if l1 <= 0.001 or l2 <= 0.001:
		return []
	return [upper, lower, hand, l1, l2]

func _bone_world(idx: int) -> Transform3D:
	return _sk.global_transform * _sk.get_bone_global_pose(idx)

# ------------------------------------------------------------------ clips
## Builds one AnimationPlayer under our control node holding every clip we could
## retarget, rooted at the same model the rig GLB provides so track paths resolve.
func _build_clips() -> void:
	if _sk == null:
		return
	_sk_rel = str(_model.get_path_to(_sk))
	var lookup := _bone_lookup()

	var ual := _pull(SRC_UAL)
	var hero := _pull(HERO_RIG)
	var merc := _pull(SRC_MERCENARY)

	# Locomotion and combat for Universal Base Characters driven by Quaternius's
	# Universal Animation Library (UAL). Both share identical Rigify bone orientations,
	# ensuring upright stances, grounded feet, and fluid combat.
	var plan := {
		C_IDLE: [_src(ual, "Idle"), _src(ual, "Sword_Idle")],
		C_IDLE_COMBAT: [_src(ual, "Sword_Idle"), _src(ual, "Idle")],
		C_WALK: [_src(ual, "Walk")],
		C_RUN: [_src(ual, "Jog_Fwd"), _src(ual, "Sprint")],
		C_SPRINT: [_src(ual, "Sprint")],
		C_JUMP_START: [_src(ual, "Jump_Start")],
		C_JUMP_LOOP: [_src(ual, "Jump")],
		C_JUMP_LAND: [_src(ual, "Jump_Land")],
		C_ROLL: [_src(ual, "Roll")],
		C_ATTACK: [_src(ual, "Sword_Attack")],
		C_JUDGMENT: [_src(ual, "Sword_Attack"), _src(ual, "Punch_Cross")],
		C_HIT: [_src(ual, "Hit_Chest"), _src(merc, "Hit Reaction")],
		C_DEATH: [_src(ual, "Death01"), _src(merc, "Falling Down")],
	}

	_anim = AnimationPlayer.new()
	_anim.name = "Locomotion"
	_model.add_child(_anim)
	_anim.root_node = _anim.get_path_to(_model)
	var lib := AnimationLibrary.new()
	for want in plan.keys():
		for src in plan[want]:
			if src == null:
				continue
			var rt := _retarget(src, lookup)
			if rt != null:
				if want in [C_IDLE, C_IDLE_COMBAT, C_WALK, C_RUN, C_SPRINT, C_JUMP_LOOP]:
					rt.loop_mode = Animation.LOOP_LINEAR
				else:
					rt.loop_mode = Animation.LOOP_NONE
				lib.add_animation(want, rt)
				_clips[want] = true
				break
	if lib.get_animation_list().size() == 0:
		push_warning("[HeroRig] no clip could be retargeted; the mesh will not animate.")
		return

	# Retarget donor clips to build specialized combat strikes (Elden Ring / FF7R / Onimusha)
	var rt_attack := _retarget(_src(ual, "Sword_Attack"), lookup)
	var rt_cross := _retarget(_src(ual, "Punch_Cross"), lookup)
	var rt_exit := _retarget(_src(ual, "Spell_Simple_Exit"), lookup)

	if rt_attack:
		lib.add_animation(C_ATTACK_SLASH, _slice_animation(rt_attack, 0.15, 0.70))
		_clips[C_ATTACK_SLASH] = true
		lib.add_animation(C_ATTACK_SPIN, _slice_animation(rt_attack, 0.10, 0.85))
		_clips[C_ATTACK_SPIN] = true
		lib.add_animation(C_ATTACK_HEAVY, _slice_animation(rt_attack, 0.05, 0.85))
		_clips[C_ATTACK_HEAVY] = true
	if rt_cross:
		lib.add_animation(C_ATTACK_THRUST, _slice_animation(rt_cross, 0.08, 0.65))
		_clips[C_ATTACK_THRUST] = true
		lib.add_animation(C_ATTACK_FLASH, _slice_animation(rt_cross, 0.05, 0.50))
		_clips[C_ATTACK_FLASH] = true
	if rt_exit:
		lib.add_animation(C_ATTACK_SLAM, _slice_animation(rt_exit, 0.0, 0.43))
		_clips[C_ATTACK_SLAM] = true
		lib.add_animation(C_ATTACK_CLEAVER, _slice_animation(rt_exit, 0.0, 0.43))
		_clips[C_ATTACK_CLEAVER] = true

	_anim.add_animation_library("", lib)
	_anim.animation_finished.connect(_on_anim_finished)
	var start_idle := C_IDLE_COMBAT if _clips.has(C_IDLE_COMBAT) else (C_IDLE if _clips.has(C_IDLE) else C_WALK)
	_anim.play(start_idle)
	_anim.speed_scale = 1.0 if (_clips.has(C_IDLE_COMBAT) or _clips.has(C_IDLE)) else idle_clip_speed

## Every bone name in this skeleton, keyed both raw and normalised.
func _bone_lookup() -> Dictionary:
	var d := {}
	for i in _sk.get_bone_count():
		var n := _sk.get_bone_name(i)
		d[n] = n
		d[_norm(n)] = n
	return d

## Pulls every named animation out of a character package, keyed by clip name.
## Duplicated so the temporary instance can be freed safely.
func _pull(scene: PackedScene) -> Dictionary:
	var d := {}
	if scene == null:
		return d
	var tmp := scene.instantiate()
	var ap := _find_player(tmp)
	if ap:
		for n in ap.get_animation_list():
			var a := ap.get_animation(n)
			if a:
				d[n] = a.duplicate(true)
	tmp.free()
	return d

func _src(bag: Dictionary, name: String) -> Animation:
	return bag.get(name, null)

## Remaps a source clip onto THIS skeleton by normalised bone name and semantic aliases.
func _retarget(src: Animation, lookup: Dictionary) -> Animation:
	if src == null:
		return null
	var out: Animation = src.duplicate(true)
	var total := out.get_track_count()
	if total == 0:
		return null
	var kept := 0
	for i in range(total - 1, -1, -1):
		var p := str(out.track_get_path(i))
		var cut := p.find(":")
		if cut < 0:
			out.remove_track(i)
			continue
		var bone := p.substr(cut + 1)
		var norm_bone := _norm(bone)
		var target: String = lookup.get(bone, "")
		if target == "":
			target = lookup.get(norm_bone, "")
		if target == "":
			var alias: String = BONE_ALIASES.get(norm_bone, "")
			if alias != "":
				target = lookup.get(alias, "")
				if target == "":
					target = lookup.get(_norm(alias), "")
		if target == "":
			out.remove_track(i)
			continue
		out.track_set_path(i, NodePath(_sk_rel + ":" + target))
		kept += 1
	if kept < maxi(4, int(total * 0.35)):
		print("[HeroRig] rejected clip '", src.resource_name, "': only ", kept, "/", total, " tracks mapped")
		return null
	return out

func _find_player(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for c in n.get_children():
		var f := _find_player(c)
		if f:
			return f
	return null

## True when the named library clip was loaded and retargeted successfully.
func has_clip(name: String) -> bool:
	return _clips.has(name)

## Length of a library clip in seconds, or 0.0 when it is unavailable. Player
## uses this to sync the dodge window to the real roll clip.
func clip_length(name: String) -> float:
	if _anim and _anim.has_animation(name):
		return _anim.get_animation(name).length
	return 0.0

## Extracts a sub-range from an authored animation to create a razor-sharp combat strike.
func _slice_animation(src: Animation, start_t: float, end_t: float, loop := false) -> Animation:
	if src == null:
		return null
	var out := Animation.new()
	out.length = maxf(end_t - start_t, 0.05)
	out.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	for track_idx in src.get_track_count():
		var path := src.track_get_path(track_idx)
		var type := src.track_get_type(track_idx)
		var new_track := out.add_track(type)
		out.track_set_path(new_track, path)
		out.track_set_interpolation_type(new_track, src.track_get_interpolation_type(track_idx))
		for k in src.track_get_key_count(track_idx):
			var t := src.track_get_key_time(track_idx, k)
			if t >= start_t - 0.001 and t <= end_t + 0.001:
				var v = src.track_get_key_value(track_idx, k)
				var trans := src.track_get_key_transition(track_idx, k)
				out.track_insert_key(new_track, clampf(t - start_t, 0.0, out.length), v, trans)
	return out

## Plays a one-shot action clip (attack, hit, death) with an optional speed scale.
func play_action(name: String, blend := 0.08, speed := 1.0) -> bool:
	if _anim == null or not _anim.has_animation(name):
		return false
	_anim.play(name, blend)
	_anim.speed_scale = speed
	return true

# ------------------------------------------------------------------ roll & jump
## Starts the real full-body dodge roll. Returns false when no roll clip could be
## retargeted, so Player can fall back instead of silently doing nothing.
func play_roll() -> bool:
	if _anim == null or not _anim.has_animation(C_ROLL):
		return false
	_rolling = true
	if _sk:
		_sk.clear_bones_global_pose_override()
	var anim := _anim.get_animation(C_ROLL)
	# Fast responsive evasion roll: 0.50s duration
	var target_time := 0.50
	var spd := anim.length / target_time if (anim and target_time > 0.0) else 1.0
	_anim.play(C_ROLL, roll_blend)
	_anim.speed_scale = spd
	_roll_timer = target_time + 0.04
	return true

func roll_duration() -> float:
	if _anim and _anim.has_animation(C_ROLL):
		return 0.50
	return 0.35

func is_rolling() -> bool:
	return _rolling

func on_jump() -> void:
	if _anim and _clips.has(C_JUMP_START):
		_jump_startup = true
		_anim.play(C_JUMP_START, 0.06)
		_anim.speed_scale = 2.4

func _on_anim_finished(name: StringName) -> void:
	var sname := str(name)
	var idle_clip := C_IDLE_COMBAT if _clips.has(C_IDLE_COMBAT) else C_IDLE
	if sname == C_ROLL:
		_rolling = false
		_roll_timer = 0.0
		if _anim and _clips.has(idle_clip):
			_anim.play(idle_clip, clip_blend)
	elif sname == C_JUMP_START:
		_jump_startup = false
		if _clips.has(C_JUMP_LOOP):
			_anim.play(C_JUMP_LOOP, 0.12)
			_anim.speed_scale = 1.0
	elif sname == C_JUMP_LAND:
		_land_timer = 0.0
	elif sname.begins_with("Attack") or sname == C_ATTACK or sname == C_JUDGMENT or sname == C_HIT:
		if _anim and not _combat_busy():
			_anim.play(idle_clip, 0.15)
			_anim.speed_scale = 1.0

# ------------------------------------------------------------------ flash
func _build_flash() -> void:
	_flash_mat = StandardMaterial3D.new()
	_flash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_flash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_flash_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_flash_mat.albedo_color = Color(1.0, 0.2, 0.2, 0.0)
	_flash_mat.emission_enabled = true
	_flash_mat.emission = Color(1.0, 0.2, 0.2)
	_flash_mat.emission_energy_multiplier = 1.5

## Additive overlay, so the imported textures are never modified.
func flash() -> void:
	if _flash_mat == null:
		return
	for mi in _meshes:
		if is_instance_valid(mi):
			mi.material_overlay = _flash_mat
	_flash_mat.albedo_color.a = 0.55
	var t := create_tween()
	t.tween_property(_flash_mat, "albedo_color:a", 0.0, 0.28)
	t.tween_callback(_clear_flash)

func _clear_flash() -> void:
	for mi in _meshes:
		if is_instance_valid(mi):
			mi.material_overlay = null

## Short recoil used for the hit reaction.
func flinch() -> void:
	_flinch = 1.0
	if play_action(C_HIT, 0.05):
		pass

## Stops posing the skeleton: used on death so the body goes limp in its clip
## pose instead of holding a guard while the corpse rotates.
func release() -> void:
	_ik_on = false
	_rolling = false
	if _sk:
		_sk.clear_bones_global_pose_override()
	if _anim:
		if _anim.has_animation(C_DEATH):
			_anim.play(C_DEATH, 0.15)
			_anim.speed_scale = 1.0
		else:
			_anim.speed_scale = 0.0

# ------------------------------------------------------------------ locomotion
## Speed-driven clip selection and playback, with no root motion of its own: the
## CharacterBody3D owns all translation, so animation and movement cannot
## double-apply. Idle is now a real idle clip rather than a slowed walk cycle.
func update_locomotion(velocity: Vector3, delta: float) -> void:
	var hs := Vector2(velocity.x, velocity.z).length()
	var accel := (hs - _prev_speed) / maxf(delta, 0.0001)
	_prev_speed = hs

	var on_floor: bool = _player.is_on_floor() if (_player and _player.has_method("is_on_floor")) else true

	# Forward lean from sustained speed, plus a little extra under acceleration.
	var target_lean := clampf(hs / maxf(run_clip_speed, 0.01), 0.0, 1.0) * 0.16 + clampf(accel / 40.0, -0.06, 0.06)
	if not on_floor:
		# Mid-air pitch tilt based on vertical movement
		target_lean = clampf(-velocity.y * 0.02, -0.15, 0.15)
	_lean = lerpf(_lean, target_lean, clampf(8.0 * delta, 0.0, 1.0))

	if _anim == null:
		_was_on_floor = on_floor
		return

	# The roll clip owns the whole body until it finishes.
	if _rolling:
		_roll_timer -= delta
		if _roll_timer <= 0.0:
			_rolling = false
		else:
			_was_on_floor = on_floor
			return

	# Active combat actions own playback until recovery finishes
	if _combat_busy():
		_apply_contact()
		_was_on_floor = on_floor
		return

	# Airborne state: slow down stride while in mid-air
	if not on_floor:
		if _anim.current_animation == C_WALK or _anim.current_animation == C_RUN or _anim.current_animation == C_SPRINT:
			_anim.speed_scale = 0.20
		_was_on_floor = false
		return
	_was_on_floor = true

	# Idle state
	if hs < 0.2:
		var idle_clip := C_IDLE_COMBAT if _clips.has(C_IDLE_COMBAT) else C_IDLE
		if _anim.current_animation != idle_clip:
			_anim.play(idle_clip, clip_blend)
		_anim.speed_scale = 1.0
		_apply_contact()
		return

	# Moving state: 3-tier blend (Walk -> Run -> Sprint)
	var sprinting: bool = Input.is_action_pressed("sprint")
	var want_sprint: bool = (sprinting and hs > 4.5) or hs > sprint_threshold
	var want_run: bool = hs > run_threshold or (sprinting and hs > 2.0)
	var clip := C_SPRINT if (want_sprint and _clips.has(C_SPRINT)) else (C_RUN if want_run else C_WALK)

	if _anim.current_animation != clip:
		_anim.play(clip, clip_blend)

	var ref: float = sprint_clip_speed if clip == C_SPRINT else (run_clip_speed if clip == C_RUN else walk_clip_speed)
	var sign_dir := 1.0
	if visual:
		var fwd := -visual.global_basis.z
		var dir := Vector3(velocity.x, 0, velocity.z).normalized()
		if dir != Vector3.ZERO and dir.dot(fwd) < backpedal_dot:
			sign_dir = -1.0    # backpedal: run the cycle backwards
	var speed_mult := clampf(hs / maxf(ref, 0.01), 0.35, 2.2) * sign_dir
	_anim.speed_scale = speed_mult
	_apply_contact()

# ------------------------------------------------------------------ frame
func _process(delta: float) -> void:
	_t += delta
	_flinch = maxf(_flinch - delta * 4.0, 0.0)
	if visual:
		var cur_yaw := visual.global_rotation.y
		var yaw_diff := wrapf(cur_yaw - _prev_yaw, -PI, PI)
		var yaw_rate := yaw_diff / maxf(delta, 0.0001)
		_prev_yaw = cur_yaw
		var bank_target := clampf(-yaw_rate * 0.03 * clampf(_prev_speed / 4.0, 0.0, 1.5), -0.20, 0.20)
		_bank = lerpf(_bank, bank_target, clampf(12.0 * delta, 0.0, 1.0))
	if _sk == null:
		return
	_update_stance(delta)
	
	# Handcrafted Quaternius UAL animations drive the skeleton naturally.
	# Clear all bone overrides so the mesh NEVER pinches, twists, or combines.
	if _sk:
		_sk.clear_bones_global_pose_override()

	# The weapon is socketed directly to hand_r via BoneAttachment3D.
	# Drive hand_attach to match weapon_socket so weapon effects/trails follow seamlessly.
	if hand_attach and weapon_socket:
		hand_attach.global_transform = weapon_socket.global_transform
	if _left_pivot and _arm_l.size() >= 3:
		_left_pivot.global_transform = _bone_world(_arm_l[2])
	_apply_contact()

## Guard stance when something hostile is close, lowered carry otherwise.
## Relaxed entirely during a roll so the tuck reads cleanly.
func _update_stance(delta: float) -> void:
	var want := 0.0
	if not _rolling:
		if _combat_busy() or _has_lock():
			want = 1.0
		else:
			for e in get_tree().get_nodes_in_group("enemies"):
				if e.has_method("is_dead") and e.is_dead():
					continue
				if e.global_position.distance_to(visual.global_position) < alert_range:
					want = 1.0
					break
	_stance = move_toward(_stance, want, stance_blend * delta)

## Dynamic lookups: Player loads this component, so it must not name the Player
## type directly (that would be a cyclic class dependency).
func _combat_busy() -> bool:
	var c = _player.get("combat") if _player else null
	return c != null and c.is_busy()

func _has_lock() -> bool:
	return _player != null and _player.get("lock_target") != null

## True once a usable skeleton is present; Player uses it to decide whether the
## procedural fallback is still needed.
func has_skeleton() -> bool:
	return _sk != null

## Dual Blades hands the off hand its own weapon instead of the handle.
func set_left_blade(n: Node3D) -> void:
	_left_pivot = n

## The authored weapon transform: grip point and blade direction blended
## between the relaxed carry and the combat guard, both in character-local
## space where forward is -Z.
func _weapon_world() -> Transform3D:
	var g := Vector3(
		lerpf(relaxed_grip.x, combat_grip.x, _stance) * _mirror,
		lerpf(relaxed_grip.y, combat_grip.y, _stance),
		lerpf(relaxed_grip.z, combat_grip.z, _stance))
	# Breathing and small weight shifts, damped once the fight starts.
	g += Vector3(0, sin(_t * 1.7), sin(_t * 1.1) * 0.7) * breathing * lerpf(1.0, 0.45, _stance)
	g += Vector3(0, 0.05, 0.10) * _flinch

	# Dynamic gait stride bounce while moving
	if _anim and (_anim.current_animation == C_WALK or _anim.current_animation == C_RUN or _anim.current_animation == C_SPRINT):
		var mult := 2.0 if _anim.current_animation == C_WALK else (2.5 if _anim.current_animation == C_RUN else 3.2)
		var gait_t := _anim.current_animation_position * TAU * mult
		var bounce := sin(gait_t) * 0.016 * clampf(_prev_speed / 3.0, 0.0, 1.0)
		g += Vector3(0, bounce, 0)
	var sprint_factor := clampf((_prev_speed - run_threshold) / maxf(sprint_clip_speed - run_threshold, 1.0), 0.0, 1.0) * (1.0 - _stance)
	g += Vector3(-0.04 * _mirror, -0.05, 0.08) * sprint_factor

	var d := Vector3(
		lerpf(relaxed_blade.x, combat_blade.x, _stance) * _mirror,
		lerpf(relaxed_blade.y, combat_blade.y, _stance),
		lerpf(relaxed_blade.z, combat_blade.z, _stance)).normalized()
	if sprint_factor > 0.01:
		d = d.rotated(Vector3.RIGHT * _mirror, 0.22 * sprint_factor).normalized()

	# The weapon model points along -Z from a grip at its origin, so its +Z runs
	# back down the handle toward the pommel.
	var z_axis := -d
	var x_axis := d.cross(Vector3.UP).normalized()
	if x_axis.length_squared() < 0.001:
		x_axis = Vector3.RIGHT
	var y_axis := z_axis.cross(x_axis).normalized()
	return Transform3D(visual.global_basis * Basis(x_axis, y_axis, z_axis), visual.to_global(g))

# ------------------------------------------------------------------ ground
## The clips and the torso lean move the root bone, and because the mesh origin
## is at the feet, that would sink the feet through the floor or lift the whole
## character off it. This measures the root bone against its idle height and
## corrects the body vertically, clamped so nothing can launch him.
## Suspended during the roll: the roll clip legitimately drops and raises the
## hips, and correcting that would fight the animation.
func _apply_contact() -> void:
	if rig == null or _sk == null:
		return
	var on_floor: bool = _player.is_on_floor() if (_player and _player.has_method("is_on_floor")) else true
	if not on_floor or _rolling:
		rig.position.y = lerpf(rig.position.y, _base_y, 0.2)
		return
		
	var ball_l = _sk.find_bone("ball_l")
	var ball_r = _sk.find_bone("ball_r")
	if ball_l < 0 or ball_r < 0:
		rig.position.y = _base_y
		return
		
	var ball_l_w := (_sk.global_transform * _sk.get_bone_global_pose(ball_l).origin).y
	var ball_r_w := (_sk.global_transform * _sk.get_bone_global_pose(ball_r).origin).y
	var floor_y := visual.global_position.y if visual else 0.0
	var lowest_sole := minf(ball_l_w, ball_r_w) - 0.01 - floor_y
	
	var target_rig_y := clampf(rig.position.y - lowest_sole, _base_y - 0.12, _base_y + 0.12)
	rig.position.y = lerpf(rig.position.y, target_rig_y, 0.35)

## Root-bone height measured in rig space so moving rig.position.y
## cannot create a feedback loop that jitters the mesh.
func _root_local_y(idx: int) -> float:
	var p := _bone_world(idx).origin
	if rig:
		return rig.to_local(p).y
	return p.y

# ------------------------------------------------------------------ IK
## Analytic two-bone IK. The arm is rotated so it reaches `target`, the elbow
## position comes from the law of cosines around the pole direction, and the
## hand is placed exactly on the target with its rotation carried across from
## the animated pose (so the wrist is never wrenched).
## Returns the hand's world transform after the solve, so an off-hand weapon can
## be hung on the left hand.
func _solve_arm(chain: Array, target: Vector3, pole_local: Vector3, weapon_basis: Basis, hand_rot: Vector3) -> Transform3D:
	var upper: int = chain[0]
	var lower: int = chain[1]
	var hand: int = chain[2]
	var gt := _sk.global_transform
	var p_up := gt * _sk.get_bone_global_pose(upper).origin
	var p_lo := gt * _sk.get_bone_global_pose(lower).origin
	var p_ha := gt * _sk.get_bone_global_pose(hand).origin
	# Measure the bone lengths from the live pose in world units. The imported
	# skeleton works in centimetres, so its rest lengths are 100x too large.
	var l1 := (p_lo - p_up).length()
	var l2 := (p_ha - p_lo).length()
	if l1 < 0.01 or l2 < 0.01:
		return Transform3D(Basis.IDENTITY, target)
	var b_up := gt.basis * _sk.get_bone_global_pose(upper).basis
	var b_lo := gt.basis * _sk.get_bone_global_pose(lower).basis
	var b_ha := gt.basis * _sk.get_bone_global_pose(hand).basis
	var to_t := target - p_up
	var d := to_t.length()
	if d < 0.001:
		return Transform3D(Basis.IDENTITY, target)
	var u := to_t / d
	# Clamp into the reachable band so the arm never hyper-extends or pops.
	var dd := clampf(d, absf(l1 - l2) * 1.05, (l1 + l2) * 0.99)
	var tgt := p_up + u * dd
	var ca := clampf((l1 * l1 + dd * dd - l2 * l2) / (2.0 * l1 * dd), -1.0, 1.0)
	var a := acos(ca)
	var pole := (visual.global_basis * Vector3(pole_local.x * _mirror, pole_local.y, pole_local.z)).normalized()
	var po := pole - u * pole.dot(u)
	if po.length_squared() < 0.0005:
		po = b_up.y
	po = po.normalized()
	var elbow := p_up + (u * cos(a) + po * sin(a)) * l1
	# Upper arm: rotate its current direction onto the shoulder -> elbow line.
	var q1 := Quaternion((p_lo - p_up).normalized(), (elbow - p_up).normalized())
	var n_up := Basis(q1) * b_up
	var n_lo := Basis(q1) * b_lo
	var n_ha := Basis(q1) * b_ha
	# Forearm: add whatever rotation is left to land on the hand target.
	var carried := elbow + Basis(q1) * (p_ha - p_lo)
	var q2 := Quaternion((carried - elbow).normalized(), (tgt - elbow).normalized())
	n_lo = Basis(q2) * n_lo
	n_ha = Basis(q2) * n_ha
	if force_hand_basis:
		n_ha = weapon_basis * Basis.from_euler(hand_rot)
	else:
		n_ha = n_ha * Basis.from_euler(hand_rot)
	_override(upper, p_up, n_up)
	_override(lower, elbow, n_lo)
	_override(hand, tgt, n_ha)
	return Transform3D(n_ha.orthonormalized(), tgt)

## Bone overrides are non-persistent: they are applied for this frame's update
## and then dropped, so next frame reads the clip's untouched pose again and the
## rotations can never accumulate.
func _override(idx: int, origin: Vector3, basis: Basis) -> void:
	if idx < 0:
		return
	var inv := _sk.global_transform.affine_inverse()
	# The skeleton carries the cm -> m scale, so only the rotation is carried
	# across: taking the scale into a bone basis would stretch the limbs.
	var local_basis := inv.basis.orthonormalized() * basis.orthonormalized()
	_sk.set_bone_global_pose_override(idx, Transform3D(local_basis, inv * origin), 1.0, true)

## Hips, spine and chest take part in the swing, and the torso leans with
## speed. This is what stops an attack from looking like an arm-only twitch.
func _torso() -> void:
	var sw_yaw := (arm_pivot.rotation.y - _rest_arm.y) * swing_torso
	var sw_pitch := (arm_pivot.rotation.x - _rest_arm.x) * swing_torso * 0.5
	_apply_body(_spine, sw_yaw * 0.50, _lean * 0.55, _bank * 0.70)
	_apply_body(_chest, sw_yaw * 0.50, _lean * 0.45 + sw_pitch * 0.25, _bank * 0.85)

func _apply_body(idx: int, yaw: float, tilt: float, roll: float = 0.0) -> void:
	if idx < 0:
		return
	var pose := _sk.get_bone_global_pose(idx)
	var b := _sk.global_transform.basis * pose.basis
	var right := visual.global_basis.x
	var fwd := -visual.global_basis.z
	# About +X by a negative angle tips forward (-Z); about forward (-Z) banks into turn
	var r := Basis(fwd, roll) * Basis(right, -tilt) * Basis(Vector3.UP, yaw)
	# Only the rotation is replaced; the bone keeps the clip's own origin.
	_override(idx, _sk.global_transform * pose.origin, r * b)

# ------------------------------------------------------------------ hero outfit
func _build_hero_outfit() -> void:
	if _sk == null:
		return
	
	# 1. Dress the base body mesh in a dark fantasy tactical warrior suit (no bare skin / underwear)
	var suit_mat := StandardMaterial3D.new()
	suit_mat.albedo_color = Color(0.12, 0.12, 0.15)
	suit_mat.metallic = 0.20
	suit_mat.roughness = 0.65
	
	for mi in _meshes:
		if is_instance_valid(mi) and mi.name == "SuperHero_Male":
			mi.set_surface_override_material(0, suit_mat)
	
	# 2. Materials for modular 3D armor
	var steel_mat := StandardMaterial3D.new()
	steel_mat.albedo_color = Color(0.18, 0.18, 0.22)
	steel_mat.metallic = 0.95
	steel_mat.roughness = 0.25

	var gold_mat := StandardMaterial3D.new()
	gold_mat.albedo_color = Color(0.72, 0.55, 0.22)
	gold_mat.metallic = 1.0
	gold_mat.roughness = 0.30

	var crimson_mat := StandardMaterial3D.new()
	crimson_mat.albedo_color = Color(0.45, 0.08, 0.10)
	crimson_mat.metallic = 0.1
	crimson_mat.roughness = 0.85

	var rune_gem_mat := StandardMaterial3D.new()
	rune_gem_mat.albedo_color = Color(1.0, 0.18, 0.18)
	rune_gem_mat.emission_enabled = true
	rune_gem_mat.emission = Color(1.0, 0.18, 0.18)
	rune_gem_mat.emission_energy_multiplier = 4.0

	# 3. Add Stylish 3D Hair (sculpted directly on head bone local coordinates, zero sky float)
	var head_bone := _sk.find_bone("Head")
	if head_bone >= 0:
		var hair_attach := _make_attachment("HeadAttachment", "Head", head_bone)
		var h_node := Node3D.new()
		hair_attach.add_child(h_node)
		var h_mat := StandardMaterial3D.new()
		h_mat.albedo_color = Color(0.08, 0.06, 0.05)
		h_mat.metallic = 0.1
		h_mat.roughness = 0.40

		# Crown of hair covering top and back of skull
		var crown := SphereMesh.new()
		crown.radius = 0.108
		crown.height = 0.16
		_mesh_part(h_node, crown, Vector3(0, 0.055, -0.015), h_mat, Vector3(-0.15, 0, 0))

		# Front parted bangs across the forehead
		var bangs_l := BoxMesh.new()
		bangs_l.size = Vector3(0.08, 0.04, 0.06)
		_mesh_part(h_node, bangs_l, Vector3(-0.045, 0.08, -0.085), h_mat, Vector3(-0.35, 0.2, 0.1))

		var bangs_r := BoxMesh.new()
		bangs_r.size = Vector3(0.08, 0.04, 0.06)
		_mesh_part(h_node, bangs_r, Vector3(0.045, 0.08, -0.085), h_mat, Vector3(-0.35, -0.2, -0.1))

		# Side swept locks
		var side_l := BoxMesh.new()
		side_l.size = Vector3(0.03, 0.12, 0.06)
		_mesh_part(h_node, side_l, Vector3(-0.10, 0.02, -0.04), h_mat, Vector3(0.1, 0, -0.15))

		var side_r := BoxMesh.new()
		side_r.size = Vector3(0.03, 0.12, 0.06)
		_mesh_part(h_node, side_r, Vector3(0.10, 0.02, -0.04), h_mat, Vector3(0.1, 0, 0.15))

		# Back layered locks
		var back_lock := BoxMesh.new()
		back_lock.size = Vector3(0.14, 0.10, 0.05)
		_mesh_part(h_node, back_lock, Vector3(0, -0.01, 0.08), h_mat, Vector3(0.3, 0, 0))

	# 4. Armored Torso Cuirass & Harness (attached to spine_02 / spine_03)
	var spine_bone := _sk.find_bone("spine_02")
	if spine_bone < 0:
		spine_bone = _sk.find_bone("spine_03")
	if spine_bone >= 0:
		var chest_attach := _make_attachment("ChestAttachment", _sk.get_bone_name(spine_bone), spine_bone)
		var cuirass := Node3D.new()
		chest_attach.add_child(cuirass)
		# Steel Breastplate
		var bp := BoxMesh.new()
		bp.size = Vector3(0.32, 0.28, 0.24)
		_mesh_part(cuirass, bp, Vector3(0, 0.02, 0.01), steel_mat)
		# Gold chest crest / trim
		var crest := BoxMesh.new()
		crest.size = Vector3(0.08, 0.16, 0.25)
		_mesh_part(cuirass, crest, Vector3(0, 0.04, 0.01), gold_mat)
		# Ember Core Gem
		var core_gem := SphereMesh.new()
		core_gem.radius = 0.025
		core_gem.height = 0.05
		_mesh_part(cuirass, core_gem, Vector3(0, 0.06, -0.12), rune_gem_mat)
		# Crimson Harness Straps
		var strap := BoxMesh.new()
		strap.size = Vector3(0.34, 0.04, 0.25)
		_mesh_part(cuirass, strap, Vector3(0, -0.08, 0.0), crimson_mat)

	# 5. Shoulder Pauldrons (clavicle_l and clavicle_r)
	for side: String in ["l", "r"]:
		var clav_name: String = "clavicle_" + side
		var c_bone := _sk.find_bone(clav_name)
		if c_bone >= 0:
			var p_attach := _make_attachment("Pauldrons_" + side, clav_name, c_bone)
			var p_node := Node3D.new()
			p_attach.add_child(p_node)
			var sign_x := 1.0 if side == "r" else -1.0
			var p_mesh := BoxMesh.new()
			p_mesh.size = Vector3(0.14, 0.08, 0.18)
			_mesh_part(p_node, p_mesh, Vector3(0.06 * sign_x, 0.05, 0), steel_mat, Vector3(0, 0, -0.25 * sign_x))
			var rim_mesh := BoxMesh.new()
			rim_mesh.size = Vector3(0.15, 0.02, 0.19)
			_mesh_part(p_node, rim_mesh, Vector3(0.06 * sign_x, 0.08, 0), gold_mat, Vector3(0, 0, -0.25 * sign_x))
			var stud := SphereMesh.new()
			stud.radius = 0.018
			stud.height = 0.036
			_mesh_part(p_node, stud, Vector3(0.10 * sign_x, 0.09, 0), rune_gem_mat)

	# 6. Combat Bracers / Gauntlets (lowerarm_l and lowerarm_r)
	for side: String in ["l", "r"]:
		var arm_name: String = "lowerarm_" + side
		var a_bone := _sk.find_bone(arm_name)
		if a_bone >= 0:
			var b_attach := _make_attachment("Bracer_" + side, arm_name, a_bone)
			var b_node := Node3D.new()
			b_attach.add_child(b_node)
			var bracer := CylinderMesh.new()
			bracer.top_radius = 0.052
			bracer.bottom_radius = 0.046
			bracer.height = 0.16
			_mesh_part(b_node, bracer, Vector3(0, 0.08, 0), steel_mat)
			var b_strap := CylinderMesh.new()
			b_strap.top_radius = 0.054
			b_strap.bottom_radius = 0.048
			b_strap.height = 0.04
			_mesh_part(b_node, b_strap, Vector3(0, 0.08, 0), crimson_mat)

	# 7. Heavy War Belt & Battle Sash (pelvis)
	var pelvis_bone := _sk.find_bone("pelvis")
	if pelvis_bone >= 0:
		var belt_attach := _make_attachment("BeltAttachment", "pelvis", pelvis_bone)
		var belt_node := Node3D.new()
		belt_attach.add_child(belt_node)
		var belt := CylinderMesh.new()
		belt.top_radius = 0.17
		belt.bottom_radius = 0.18
		belt.height = 0.09
		_mesh_part(belt_node, belt, Vector3(0, 0.02, 0), crimson_mat)
		var buckle := BoxMesh.new()
		buckle.size = Vector3(0.08, 0.09, 0.03)
		_mesh_part(belt_node, buckle, Vector3(0, 0.02, -0.18), gold_mat)
		var sash_l := BoxMesh.new()
		sash_l.size = Vector3(0.09, 0.35, 0.02)
		_mesh_part(belt_node, sash_l, Vector3(-0.16, -0.16, 0.02), crimson_mat, Vector3(0, 0, 0.15))
		var sash_r := BoxMesh.new()
		sash_r.size = Vector3(0.09, 0.35, 0.02)
		_mesh_part(belt_node, sash_r, Vector3(0.16, -0.16, 0.02), crimson_mat, Vector3(0, 0, -0.15))

	# 8. Armored Greaves / Boots (calf_l and calf_r)
	for side: String in ["l", "r"]:
		var calf_name: String = "calf_" + side
		var leg_bone := _sk.find_bone(calf_name)
		if leg_bone >= 0:
			var g_attach := _make_attachment("Greave_" + side, calf_name, leg_bone)
			var g_node := Node3D.new()
			g_attach.add_child(g_node)
			var greave := CylinderMesh.new()
			greave.top_radius = 0.065
			greave.bottom_radius = 0.052
			greave.height = 0.26
			_mesh_part(g_node, greave, Vector3(0, 0.14, 0), steel_mat)
			var ridge := BoxMesh.new()
			ridge.size = Vector3(0.03, 0.24, 0.03)
			_mesh_part(g_node, ridge, Vector3(0, 0.14, -0.06), gold_mat)

	# 9. High-Collar Battle Scarf / Mantle (neck_01)
	var neck_bone := _sk.find_bone("neck_01")
	if neck_bone >= 0:
		var neck_attach := _make_attachment("NeckAttachment", "neck_01", neck_bone)
		var scarf_node := Node3D.new()
		neck_attach.add_child(scarf_node)
		var cowl := CylinderMesh.new()
		cowl.top_radius = 0.12
		cowl.bottom_radius = 0.14
		cowl.height = 0.08
		_mesh_part(scarf_node, cowl, Vector3(0, 0.02, 0), crimson_mat)

func _make_attachment(node_name: String, bone_name: String, bone_idx: int) -> BoneAttachment3D:
	var ba := BoneAttachment3D.new()
	ba.name = node_name
	_sk.add_child(ba)
	ba.bone_name = bone_name
	ba.bone_idx = bone_idx
	return ba

func _mesh_part(parent: Node3D, mesh: Mesh, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.rotation = rot
	mi.material_override = mat
	parent.add_child(mi)
	return mi
