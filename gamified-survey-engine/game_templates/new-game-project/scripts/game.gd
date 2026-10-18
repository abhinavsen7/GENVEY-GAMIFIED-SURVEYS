extends Node3D
## Game-state manager (root of main.tscn).
## Flow: TITLE -> COMBAT -> (wave cleared) REWARD -> [SURVEY] -> COMBAT ... ->
## final wave -> portal -> victory, or game over. Restart reloads the scene.

enum Phase { TITLE, COMBAT, REWARD, SURVEY, FINAL, ENDED }

const PickupRes := preload("res://scripts/loot/pickup.gd")
const SFX := preload("res://scripts/audio/sfx.gd")
const SurveyNPC := preload("res://scripts/npc/survey_npc.gd")

## Survives scene reloads so Restart skips the title screen.
static var skip_title := false

@export var wave_delay := 2.5
@export var potion_heal_fraction := 0.3
@export var weapon_bonus := 0.2
## Each wave lists Enemy.Kind values. The final wave contains the elite.
var waves: Array = [
	[Enemy.Kind.GRUNT, Enemy.Kind.GRUNT, Enemy.Kind.GRUNT],
	[Enemy.Kind.GRUNT, Enemy.Kind.KNIGHT, Enemy.Kind.ASSASSIN, Enemy.Kind.ASSASSIN],
	[Enemy.Kind.ELITE, Enemy.Kind.ASSASSIN, Enemy.Kind.GRUNT, Enemy.Kind.GRUNT],
]
## Weapon drop per reward phase (index = wave index).
var weapon_drops := [
	{"name": "Shadow Blade", "desc": "A blade forged from living shadow. +20% melee damage."},
	{"name": "Great Sword", "desc": "A massive two-handed blade with ember runes. +20% melee damage."},
	{"name": "Dual Blades", "desc": "Twin violet short swords for both hands. +20% melee damage."},
]

@onready var arena: Arena = $Arena
@onready var player: Player = $Player
@onready var hud: HUD = $HUD
var survey_ui: SurveyUI

var phase := Phase.TITLE
var _wave := -1
var _alive := 0
var _kills := 0
var _elapsed := 0.0
var _over := false
var _rewarded_waves := {}      # wave index -> true; blocks duplicate loot
var _token_counted := {}       # wave number -> true; analytics counted once
var _survey_done := {}         # wave number -> true; one bonus per wave
var _survey_started := false
var _survey_wave := 0
var _survey_pos := Vector3.ZERO
var _nearest: PickupRes
var _nearest_npc: SurveyNPC = null
var _query := PhysicsShapeQueryParameters3D.new()

func _ready() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	SurveyStore.load_data()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.7
	_query.shape = sphere
	_query.collision_mask = 1
	survey_ui = SurveyUI.new()
	add_child(survey_ui)
	survey_ui.started.connect(_on_survey_started)
	survey_ui.abandoned.connect(_on_survey_abandoned)
	survey_ui.completed.connect(_on_survey_completed)
	player.global_position = arena.player_spawn
	player.reset_camera()
	player.health.changed.connect(hud.set_health)
	player.health.died.connect(_on_player_died)
	player.combat.combo_changed.connect(hud.set_combo)
	player.combat.special_changed.connect(hud.set_special)
	player.combat.skills_changed.connect(hud.set_skills)
	player.combat.ult_changed.connect(hud.set_ult)
	hud.shake_reduced.connect(func(on: bool): player.shake_scale = 0.35 if on else 1.0)
	hud.start_pressed.connect(start)
	hud.restart_pressed.connect(restart)
	hud.sensitivity_changed.connect(func(v: float): player.mouse_sensitivity = v)
	arena.portal_entered.connect(_on_portal)
	hud.set_health(player.health.current, player.health.max_health)
	hud.set_objective("The temple awaits...")
	if skip_title:
		start()
	else:
		hud.show_title()

func start() -> void:
	hud.begin_play()
	player.input_enabled = true
	phase = Phase.COMBAT
	hud.set_objective("Defeat the corrupted guardians")
	get_tree().create_timer(1.0).timeout.connect(_next_wave)

# ---------------------------------------------------------------- waves
func _next_wave() -> void:
	if _over or phase == Phase.SURVEY:
		return
	_wave += 1
	var list: Array = waves[_wave]
	var final := _wave == waves.size() - 1
	phase = Phase.FINAL if final else Phase.COMBAT
	hud.banner("FINAL WAVE - THE FALLEN CHAMPION" if final else "WAVE %d" % (_wave + 1))
	hud.set_objective("Wave %d / %d  -  Defeat all enemies" % [_wave + 1, waves.size()])
	var points := arena.spawn_points.duplicate()
	points.shuffle()
	for i in list.size():
		var kind: Enemy.Kind = list[i]
		var pos: Vector3 = Vector3(0, 0.2, -11) if kind == Enemy.Kind.ELITE else points[i % points.size()]
		_spawn(kind, pos)

func _spawn(kind: Enemy.Kind, pos: Vector3) -> void:
	var e := Enemy.new()
	e.setup(kind)
	e.target = player
	e.position = pos
	add_child(e)
	e.died.connect(_on_enemy_died)
	_alive += 1
	FX.death_burst(self, pos + Vector3(0, 1, 0))  # summon smoke

func _on_enemy_died(_e: Enemy) -> void:
	_alive -= 1
	_kills += 1
	hud.set_kills(_kills)
	if _alive > 0 or _over:
		return
	# The survey Damage Boost lasts exactly one wave.
	player.combat.temp_mult = 1.0
	_refresh_buffs()
	if _wave < waves.size() - 1:
		_begin_reward_phase()
	else:
		arena.activate_portal()
		hud.banner("THE SEAL IS BROKEN")
		hud.set_objective("Escape through the portal (north)")

# ---------------------------------------------------------------- rewards
func _begin_reward_phase() -> void:
	if _rewarded_waves.has(_wave):
		return  # completion fired twice: never duplicate loot
	_rewarded_waves[_wave] = true
	phase = Phase.REWARD
	hud.banner("WAVE CLEARED")
	hud.set_objective("Speak to the Scholars [E]   -   Press G to begin wave %d" % (_wave + 2))
	var wave_num := _wave + 1
	var spots := _find_spawn_spots(3)
	_drop(PickupRes.Kind.HEALTH, spots[0], wave_num)
	_drop(PickupRes.Kind.ENERGY, spots[1], wave_num)
	# Wave 1 always drops the Shadow Blade; wave 2 rolls Great Sword or Dual Blades.
	var w: Dictionary = weapon_drops[0 if _wave == 0 else randi_range(1, weapon_drops.size() - 1)]
	if not player.combat.owned_weapons.has(w.name):
		_drop(PickupRes.Kind.WEAPON, spots[2], wave_num, w.name, w.desc)
	# Spawn 2 interactive NPCs to ask survey questions and grant blessings
	_spawn_survey_npcs(wave_num)

func _spawn_survey_npcs(wave_num: int) -> void:
	var existing := get_tree().get_nodes_in_group("survey_npcs")
	if existing.size() >= 2:
		for n in existing:
			if n is SurveyNPC:
				n.wave = wave_num
				n.consulted = false
				n._update_label()
		return
	# NPC 1: Sir George, Gothic Inquisitor
	var npc1 := SurveyNPC.new()
	npc1.setup(SurveyNPC.Kind.INQUISITOR, wave_num)
	npc1.position = Vector3(-3.2, 0.0, -1.2)
	add_child(npc1)
	FX.hit_sparks(self, npc1.position + Vector3(0, 1, 0), true)
	
	# NPC 2: Rowan, Relic Chronicler
	var npc2 := SurveyNPC.new()
	npc2.setup(SurveyNPC.Kind.CHRONICLER, wave_num)
	npc2.position = Vector3(3.2, 0.0, -1.2)
	add_child(npc2)
	FX.hit_sparks(self, npc2.position + Vector3(0, 1, 0), true)

func _drop(kind: PickupRes.Kind, pos: Vector3, wave_num: int, n := "", d := "") -> PickupRes:
	var p := PickupRes.new()
	p.setup(kind, wave_num, n, d)
	p.position = pos
	add_child(p)
	FX.hit_sparks(self, pos + Vector3(0, 1, 0))
	return p

## Picks reachable floor points: snapped to the navmesh and clear of walls,
## pillars and rubble (sphere overlap test on the world layer).
func _find_spawn_spots(count: int) -> Array[Vector3]:
	var out: Array[Vector3] = []
	var map := arena.get_navigation_map()
	var space := get_world_3d().direct_space_state
	var start_angle := randf() * TAU
	for ring in [4.5, 6.5, 8.5, 3.0]:
		for i in 10:
			if out.size() >= count:
				return out
			var a: float = start_angle + TAU * i / 10.0
			var guess := Vector3(cos(a) * ring, 0.0, sin(a) * ring - 1.0)
			var p := NavigationServer3D.map_get_closest_point(map, guess)
			if p.distance_to(guess) > 1.0:
				continue
			_query.transform = Transform3D(Basis.IDENTITY, p + Vector3(0, 0.9, 0))
			if not space.intersect_shape(_query, 1).is_empty():
				continue
			var too_close := false
			for o in out:
				if o.distance_to(p) < 2.5:
					too_close = true
			if not too_close:
				out.append(Vector3(p.x, 0.0, p.z))
	while out.size() < count:  # fallback: open centre area
		out.append(Vector3(randf_range(-2, 2), 0.0, randf_range(-3, 1)))
	return out

func _process(delta: float) -> void:
	if player.input_enabled and not _over:
		_elapsed += delta
	_update_interaction()
	if phase == Phase.REWARD and Input.is_action_just_pressed("next_wave"):
		_end_reward_phase()

func _end_reward_phase() -> void:
	for p in get_tree().get_nodes_in_group("pickups"):
		p.queue_free()  # leftover loot does not carry into combat
	for n in get_tree().get_nodes_in_group("survey_npcs"):
		FX.death_burst(self, n.global_position + Vector3(0, 1, 0))
		n.queue_free()
	_nearest = null
	_nearest_npc = null
	hud.hide_prompt()
	phase = Phase.COMBAT
	hud.set_objective("Prepare yourself...")
	get_tree().create_timer(1.0).timeout.connect(_next_wave)

func _update_interaction() -> void:
	_nearest = null
	_nearest_npc = null
	var best := INF
	if phase == Phase.REWARD and not player.health.dead:
		# Check NPCs first for dialogue / survey
		for n in get_tree().get_nodes_in_group("survey_npcs"):
			if n is SurveyNPC:
				var d: float = n.update_proximity(player.global_position)
				if d < n.interact_radius and d < best:
					best = d
					_nearest_npc = n
		# Check pickups if no closer NPC
		for p in get_tree().get_nodes_in_group("pickups"):
			var d: float = p.update_proximity(player.global_position)
			if d < p.interact_radius and d < best:
				best = d
				_nearest = p
				_nearest_npc = null
	if _nearest_npc:
		hud.show_prompt(_nearest_npc.npc_name, _nearest_npc.dialogue_prompt, "Speak")
		if Input.is_action_just_pressed("interact"):
			_talk_to_npc(_nearest_npc)
	elif _nearest:
		hud.show_prompt(_nearest.item_name, _nearest.description, "Collect")
		if Input.is_action_just_pressed("interact"):
			_collect(_nearest)
	else:
		hud.hide_prompt()

func _talk_to_npc(npc: SurveyNPC) -> void:
	if player.combat.is_busy() or player.is_dodging():
		hud.toast("Finish your action first")
		return
	if _survey_done.has(npc.wave) or npc.is_consulted():
		hud.toast("%s: 'Go forth, Champion! Our sacred blessings remain with you.'" % npc.npc_name, Color(1, 0.9, 0.5))
		return
	SFX.pickup(self)
	hud.toast("%s: 'Hail, warrior! Share your impressions to claim the relic blessing.'" % npc.npc_name, Color(1, 0.9, 0.6))
	_open_survey(npc.wave, npc.global_position)

## Applies a pickup's effect. try_collect() guarantees one application.
func _collect(p: PickupRes) -> void:
	if player.combat.is_busy() or player.is_dodging():
		hud.toast("Finish your attack first")
		return
	var pos := p.global_position + Vector3(0, 1, 0)
	match p.kind:
		PickupRes.Kind.HEALTH:
			if player.health.current >= player.health.max_health:
				hud.toast("Health is already full - save the potion for later")
				return
			if p.try_collect():
				SFX.pickup(self)
				player.health.heal(player.health.max_health * potion_heal_fraction)
				FX.hit_sparks(self, pos)
				hud.toast("+30% Health restored", Color(1, 0.4, 0.4))
		PickupRes.Kind.ENERGY:
			if player.combat.special_ready():
				hud.toast("Shockwave is already charged")
				return
			if p.try_collect():
				SFX.pickup(self)
				player.combat.restore_energy(1.0)
				FX.shockwave(self, p.global_position, 1.5)
				hud.toast("Shockwave recharged", Color(0.6, 0.55, 1))
		PickupRes.Kind.WEAPON:
			if player.combat.owned_weapons.has(p.item_name) or not p.try_collect():
				return
			SFX.pickup(self)
			player.combat.owned_weapons.append(p.item_name)
			player.combat.weapon_mult *= 1.0 + weapon_bonus
			player.combat.weapon_name = p.item_name
			player.equip_weapon(p.item_name)
			FX.hit_sparks(self, pos, true)
			hud.toast("%s equipped - %s" % [p.item_name, p.description], Color(1, 0.7, 0.3))
			_refresh_buffs()
		PickupRes.Kind.SURVEY:
			if survey_ui.is_open or _survey_done.has(p.wave) or not p.try_collect():
				return
			SFX.pickup(self)
			if not _token_counted.has(p.wave):
				_token_counted[p.wave] = true
				SurveyStore.count("tokens_collected")
			FX.hit_sparks(self, pos, true)
			_open_survey(p.wave, p.global_position)

func _refresh_buffs() -> void:
	hud.set_buffs(player.combat.weapon_name, player.combat.weapon_mult, player.combat.temp_mult)

# ---------------------------------------------------------------- survey
func _open_survey(wave_num: int, pos: Vector3) -> void:
	phase = Phase.SURVEY
	_survey_wave = wave_num
	_survey_pos = pos
	_survey_started = false
	hud.hide_prompt()
	hud.block_pause = true
	get_tree().paused = true  # freezes enemies, timers and player input
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	survey_ui.open(wave_num, SurveyStore.get_draft(wave_num))

func _on_survey_started() -> void:
	_survey_started = true
	SurveyStore.count("started")

func _on_survey_abandoned(draft: Dictionary) -> void:
	SurveyStore.save_draft(_survey_wave, draft)
	if _survey_started:
		SurveyStore.count("abandoned")
	# The relic stays in the world so the player can resume later.
	_drop(PickupRes.Kind.SURVEY, Vector3(_survey_pos.x, 0.0, _survey_pos.z), _survey_wave)
	hud.toast("The relic waits. Your answers were kept.", Color(1, 0.85, 0.4))
	_close_survey()

func _on_survey_completed(answers: Dictionary, reward_id: String) -> void:
	if _survey_done.has(_survey_wave):
		_close_survey()
		return  # repeated-claim guard
	_survey_done[_survey_wave] = true
	SurveyStore.record_completion(_survey_wave, answers, reward_id)
	for n in get_tree().get_nodes_in_group("survey_npcs"):
		if n is SurveyNPC:
			n.mark_consulted()
	match reward_id:
		"heal_50":
			player.health.heal(player.health.max_health * 0.5)
			hud.toast("Relic bonus: +50% Health", Color(1, 0.4, 0.4))
		"damage_15":
			player.combat.temp_mult = 1.15
			hud.toast("Relic bonus: +15% damage for the next wave", Color(1, 0.7, 0.3))
		"energy_full":
			player.combat.restore_energy(1.0)
			hud.toast("Relic bonus: Shockwave fully charged", Color(0.6, 0.55, 1))
	_refresh_buffs()
	_close_survey()

func _close_survey() -> void:
	get_tree().paused = false
	hud.block_pause = false
	phase = Phase.REWARD
	if hud.playing:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if event.is_action_pressed("debug_stats"):
		hud.toggle_debug(SurveyAnalytics.report_text())

# ---------------------------------------------------------------- end states
func _on_portal() -> void:
	if _over:
		return
	_over = true
	phase = Phase.ENDED
	player.input_enabled = false
	hud.show_end(true, "Enemies defeated: %d     Time: %d:%02d" % [_kills, int(_elapsed) / 60, int(_elapsed) % 60])

func _on_player_died() -> void:
	if _over:
		return
	_over = true
	phase = Phase.ENDED
	player.input_enabled = false
	get_tree().create_timer(1.3).timeout.connect(func(): hud.show_end(false, "Enemies defeated: %d  -  Wave %d" % [_kills, _wave + 1]))

func restart() -> void:
	skip_title = true
	Engine.time_scale = 1.0
	get_tree().paused = false
	get_tree().reload_current_scene()
