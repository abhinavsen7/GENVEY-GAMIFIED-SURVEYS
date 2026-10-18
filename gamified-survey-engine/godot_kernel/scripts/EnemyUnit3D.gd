extends CharacterBody3D
class_name EnemyUnit3D

var enemy_data: Dictionary = {}
var hp: float = 140.0
var max_hp: float = 140.0
var poise: float = 80.0
var max_poise: float = 80.0
var stagger_timer: float = 0.0
var windup_timer: float = 0.0
var is_dead: bool = false
var anim_player: AnimationPlayer = null
var target_player: CharacterBody3D = null
var hp_label_3d: Label3D = null

signal enemy_slain(enemy_data: Dictionary, world_pos: Vector3)

func setup_enemy(data: Dictionary, model_node: Node3D, player_ref: CharacterBody3D) -> void:
	enemy_data = data
	hp = float(data.get("hp", 140.0))
	max_hp = hp
	poise = float(data.get("poise", 80.0))
	max_poise = poise
	target_player = player_ref
	add_to_group("enemies")

	var col = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.55
	cap.height = 1.9
	col.shape = cap
	col.position = Vector3(0, 0.95, 0)
	add_child(col)

	add_child(model_node)
	anim_player = _find_anim(model_node)
	_play_best(["Idle", "Sword_Idle"])

	hp_label_3d = Label3D.new()
	hp_label_3d.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	hp_label_3d.position = Vector3(0, 2.35, 0)
	hp_label_3d.font_size = 36
	hp_label_3d.modulate = Color("#f87171") if not bool(data.get("is_boss", false)) else Color("#fbbf24")
	add_child(hp_label_3d)
	_update_overhead_label()

func _update_overhead_label() -> void:
	if not hp_label_3d:
		return
	var prefix = "👑 " if bool(enemy_data.get("is_boss", false)) else ""
	var state_tag = " [STAGGERED!]" if stagger_timer > 0.0 else (" [⚠️ ATTACKING!]" if windup_timer > 0.45 else "")
	hp_label_3d.text = prefix + str(enemy_data.get("name", "Guardian")) + "\nHP: " + str(int(hp)) + "/" + str(int(max_hp)) + state_tag

func apply_weapon_hit(dmg: float, poise_dmg: float, _attacker_id: String) -> void:
	if is_dead:
		return
	var mult = 2.0 if stagger_timer > 0.0 else 1.0
	hp = max(0.0, hp - dmg * mult)
	poise = max(0.0, poise - poise_dmg)
	_play_best(["Hit_A", "Hit_Chest"])
	if poise <= 0.0:
		stagger_timer = 2.2
		poise = max_poise
	_update_overhead_label()
	if hp <= 0.0:
		is_dead = true
		_play_best(["Death_A", "Death01"])
		if hp_label_3d:
			hp_label_3d.text = "💀 DEFEATED"
		emit_signal("enemy_slain", enemy_data, global_position)
		await get_tree().create_timer(1.2).timeout
		if is_instance_valid(self):
			visible = false

func apply_parry_stagger() -> void:
	stagger_timer = 3.0
	windup_timer = 0.0
	poise = 0.0
	_update_overhead_label()

func _physics_process(delta: float) -> void:
	if is_dead or not target_player or not is_instance_valid(target_player):
		return
	if stagger_timer > 0.0:
		stagger_timer = max(0.0, stagger_timer - delta)
		_update_overhead_label()
		return

	var d = global_position.distance_to(target_player.global_position)
	if d < 12.0 and d > 2.2:
		windup_timer = 0.0
		var dir = (target_player.global_position - global_position).normalized()
		velocity.x = dir.x * 2.9
		velocity.z = dir.z * 2.9
		look_at(Vector3(target_player.global_position.x, global_position.y, target_player.global_position.z), Vector3.UP)
		_play_best(["Running_A", "Jog_Fwd_Loop", "Walking_A"])
		move_and_slide()
	elif d <= 2.2:
		velocity = Vector3.ZERO
		windup_timer += delta
		_update_overhead_label()
		if windup_timer >= 0.95:
			windup_timer = 0.0
			_play_best(["1H_Melee_Attack_Chop", "Sword_Regular_A", "Attack"])
			if bool(target_player.get("is_parrying")):
				if target_player.has_method("notify_parry_success"):
					target_player.call("notify_parry_success", self)
			elif not bool(target_player.get("is_invincible")):
				target_player.set("hp", max(0.0, float(target_player.get("hp")) - 14.0))
			_update_overhead_label()

func _find_anim(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for c in n.get_children():
		var f = _find_anim(c)
		if f:
			return f
	return null

func _play_best(candidates: Array) -> void:
	if not anim_player:
		return
	for c in candidates:
		if anim_player.has_animation(c):
			if anim_player.current_animation != c:
				anim_player.play(c)
			return
