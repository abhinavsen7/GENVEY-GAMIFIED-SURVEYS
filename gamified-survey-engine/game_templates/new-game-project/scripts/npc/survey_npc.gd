class_name SurveyNPC
extends Node3D
## Interactive NPC that spawns after waves to ask survey questions, discuss
## combat performance, and grant blessed relic rewards.

enum Kind { INQUISITOR, CHRONICLER }

const SRC_GOTHIC := preload("res://characters/gothic_swordsman_35784c99/rig.glb")
const SRC_MERCENARY := preload("res://characters/mercenary_ef761979/rig.glb")

@export var kind: Kind = Kind.INQUISITOR
@export var interact_radius := 2.8
@export var notice_radius := 6.5

var npc_name := "Sir George"
var title := "Gothic Inquisitor"
var dialogue_prompt := "Share your combat impressions to claim sacred blessings"
var wave := 1
var consulted := false

var _model: Node3D
var _anim: AnimationPlayer
var _aura: OmniLight3D
var _label: Label3D
var _player: Node3D
var _target_yaw := 0.0

func setup(k: Kind, wave_number: int) -> void:
	kind = k
	wave = wave_number
	if kind == Kind.INQUISITOR:
		npc_name = "Sir George"
		title = "Gothic Inquisitor"
		dialogue_prompt = "Reflect on this battle and receive the Order's blessing."
	else:
		npc_name = "Rowan"
		title = "Relic Chronicler"
		dialogue_prompt = "Appraise your arsenal and unveil ancient boons."

func _ready() -> void:
	add_to_group("survey_npcs")
	add_to_group("interactables")
	
	# Instantiate textured, rigged character model
	var scene: PackedScene = SRC_GOTHIC if kind == Kind.INQUISITOR else SRC_MERCENARY
	if scene:
		_model = scene.instantiate()
		add_child(_model)
		_model.rotation.y = PI
		_find_and_play_idle(_model)
	
	# Warm lantern aura
	_aura = OmniLight3D.new()
	_aura.light_color = Color(1.0, 0.85, 0.5) if kind == Kind.INQUISITOR else Color(0.6, 0.8, 1.0)
	_aura.light_energy = 1.8
	_aura.omni_range = 4.5
	_aura.position.y = 1.4
	add_child(_aura)
	
	# Overhead nameplate / prompt
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.no_depth_test = true
	_label.font_size = 20
	_label.outline_size = 6
	_label.outline_modulate = Color(0, 0, 0, 0.9)
	_label.modulate = Color(1.0, 0.9, 0.6) if kind == Kind.INQUISITOR else Color(0.7, 0.9, 1.0)
	_label.position.y = 2.15
	_update_label()
	add_child(_label)

func _update_label() -> void:
	if _label == null:
		return
	if consulted:
		_label.text = "%s\n[%s]\n(Consulted)" % [npc_name, title]
		_label.modulate = Color(0.7, 0.7, 0.7, 0.7)
	else:
		_label.text = "%s\n[%s]\n[E] Speak" % [npc_name, title]

var _t := randf() * TAU

func _find_and_play_idle(node: Node) -> void:
	for c in node.find_children("*", "AnimationPlayer", true, false):
		var ap: AnimationPlayer = c
		_anim = ap
		var anim_list := ap.get_animation_list()
		var chosen := ""
		for want in ["Idle", "idle", "Armature|clip0|baselayer"]:
			if anim_list.has(want):
				chosen = want
				break
		if chosen == "" and anim_list.size() > 0:
			chosen = anim_list[0]
		
		if chosen != "":
			var a := ap.get_animation(chosen)
			if a:
				a.loop_mode = Animation.LOOP_LINEAR
			ap.play(chosen)
			ap.speed_scale = 1.0
			var clip_name := chosen
			ap.animation_finished.connect(func(_name):
				if is_instance_valid(ap):
					ap.play(clip_name)
			)
			return

func update_proximity(player_pos: Vector3) -> float:
	var d := global_position.distance_to(player_pos)
	if d < notice_radius:
		# Smoothly turn to face player
		var to_p := (player_pos - global_position)
		to_p.y = 0.0
		if to_p.length_squared() > 0.01:
			_target_yaw = atan2(to_p.x, to_p.z)
	return d

func _process(delta: float) -> void:
	_t += delta
	if _model:
		_model.rotation.y = lerp_angle(_model.rotation.y, _target_yaw, clampf(6.0 * delta, 0.0, 1.0))
		_model.position.y = sin(_t * 2.2) * 0.012

func mark_consulted() -> void:
	consulted = true
	_update_label()

func is_consulted() -> bool:
	return consulted
