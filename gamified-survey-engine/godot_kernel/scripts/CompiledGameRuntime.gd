extends Node3D

const MasterCombatControllerScript = preload("res://scripts/MasterCombatController.gd")
const SpellAndSkillHotbarScript = preload("res://scripts/SpellAndSkillHotbar.gd")
const EnemyUnit3DScript = preload("res://scripts/EnemyUnit3D.gd")
const InteractiveProp3DScript = preload("res://scripts/InteractiveProp3D.gd")
const World2DControllerScript = preload("res://scripts/World2DController.gd")

var config: Dictionary = {}
var genre_mode: String = "DARK_SOULS_ACTION"
var dimension_mode: String = "3D"

var player_3d: CharacterBody3D = null
var hotbar_node: Node = null
var player_2d: CharacterBody2D = null
var world_2d_root: Node2D = null

var npcs: Array = []
var loot_weapons: Array = []
var active_npc: Dictionary = {}

# Clean HUD & Inventory Nodes
var hud_label: Label
var sub_label: Label
var banner_label: Label
var hotbar_container: HBoxContainer
var inventory_panel: PanelContainer
var inventory_vbox: VBoxContainer
var modal_panel: PanelContainer
var modal_text: Label

func _ready() -> void:
	var cfg_file = "res://scenes/compiled_config.json"
	if FileAccess.file_exists(cfg_file):
		var raw = FileAccess.get_file_as_string(cfg_file)
		var parsed = JSON.parse_string(raw)
		if typeof(parsed) == TYPE_DICTIONARY:
			config = parsed

	genre_mode = str(config.get("style_mode", config.get("genre_mode", "DARK_SOULS_ACTION")))
	dimension_mode = str(config.get("dimension", "3D"))
	loot_weapons = config.get("weapons", [])

	_setup_hud()
	if dimension_mode == "2D":
		_spawn_compiled_2d_world()
	else:
		_spawn_compiled_3d_world()

func _setup_hud() -> void:
	var canvas = CanvasLayer.new()
	canvas.name = "CleanGameplayHUD"
	add_child(canvas)

	# Top-Left Stats HUD
	var top_bar = PanelContainer.new()
	top_bar.position = Vector2(20, 20)
	top_bar.custom_minimum_size = Vector2(640, 82)
	canvas.add_child(top_bar)

	var vbox = VBoxContainer.new()
	top_bar.add_child(vbox)

	hud_label = Label.new()
	hud_label.text = str(config.get("campaign_title", "Compiled Campaign")) + " [" + dimension_mode + " " + genre_mode + "]"
	vbox.add_child(hud_label)

	sub_label = Label.new()
	sub_label.text = "WASD: Move | LMB: Combo | Shift+LMB: Heavy | RMB: Parry | Space: Roll | [1-5]: Hotbar | [Q]: Lock-On | [I]: Inventory | [E]: Interact"
	vbox.add_child(sub_label)

	# Center Combat / Riposte / Spell Banner
	banner_label = Label.new()
	banner_label.position = Vector2(400, 125)
	banner_label.custom_minimum_size = Vector2(480, 42)
	banner_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_label.modulate = Color("#fbbf24")
	banner_label.text = ""
	canvas.add_child(banner_label)

	# Bottom 5-Slot Spell & Affordance Hotbar
	var hb_panel = PanelContainer.new()
	hb_panel.position = Vector2(290, 635)
	hb_panel.custom_minimum_size = Vector2(700, 64)
	canvas.add_child(hb_panel)

	hotbar_container = HBoxContainer.new()
	hotbar_container.alignment = BoxContainer.ALIGNMENT_CENTER
	hb_panel.add_child(hotbar_container)

	var slot_titles = [
		"[1] 🔥 Fireball AoE",
		"[2] ❄️ Frost Nova",
		"[3] 🗝️ Lockpick/Torch",
		"[4] 🧪 Healing Flask",
		"[5] ⚡ Refresh AP/Pulse"
	]
	for idx in range(slot_titles.size()):
		var btn = Button.new()
		btn.text = slot_titles[idx]
		btn.custom_minimum_size = Vector2(132, 48)
		var slot_num = idx + 1
		btn.pressed.connect(func(): _trigger_hotbar_button(slot_num))
		hotbar_container.add_child(btn)

	# Right-Side Weapon & Loot Inventory Drawer [I]
	inventory_panel = PanelContainer.new()
	inventory_panel.position = Vector2(880, 110)
	inventory_panel.custom_minimum_size = Vector2(370, 380)
	inventory_panel.visible = false
	canvas.add_child(inventory_panel)

	inventory_vbox = VBoxContainer.new()
	inventory_panel.add_child(inventory_vbox)
	_rebuild_inventory_list()

	# Survey Encounter / Covenant Shrine Modal
	modal_panel = PanelContainer.new()
	modal_panel.position = Vector2(280, 410)
	modal_panel.custom_minimum_size = Vector2(720, 200)
	modal_panel.visible = false
	canvas.add_child(modal_panel)

	modal_text = Label.new()
	modal_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	modal_panel.add_child(modal_text)

func _rebuild_inventory_list() -> void:
	for c in inventory_vbox.get_children():
		c.queue_free()
	var title = Label.new()
	title.text = "🎒 WEAPON & RELIC INVENTORY [Press I to Close]"
	title.modulate = Color("#fbbf24")
	inventory_vbox.add_child(title)

	for w in loot_weapons:
		var btn = Button.new()
		var w_name = str(w.get("name", "Relic Weapon"))
		var w_dmg = str(int(float(w.get("base_damage", 30))))
		btn.text = "⚔️ Equip " + w_name + " (" + w_dmg + " DMG)"
		var weapon_dict: Dictionary = w
		btn.pressed.connect(func():
			if player_3d and player_3d.has_method("equip_weapon_glb"):
				player_3d.call("equip_weapon_glb", weapon_dict)
		)
		inventory_vbox.add_child(btn)

func _trigger_hotbar_button(slot_num: int) -> void:
	if not hotbar_node:
		return
	match slot_num:
		1: hotbar_node.call("cast_fireball_aoe")
		2: hotbar_node.call("cast_frost_nova")
		3: hotbar_node.call("trigger_lockpick_or_hack")
		4: hotbar_node.call("drink_healing_flask")
		5: hotbar_node.call("trigger_turn_or_telekinesis")

func _show_banner(msg: String) -> void:
	banner_label.text = msg
	await get_tree().create_timer(2.0).timeout
	if banner_label.text == msg:
		banner_label.text = ""

func _load_model_safe(res_path: String, fallback_path: String) -> Node3D:
	for p in [res_path, fallback_path, "res://assets/kaykit/adventurers/Knight.glb"]:
		if p != "" and ResourceLoader.exists(p):
			var packed = load(p)
			if packed is PackedScene:
				var inst = packed.instantiate()
				if inst is Node3D:
					return inst
	var box = MeshInstance3D.new()
	box.mesh = BoxMesh.new()
	return box

func _url_to_res(u: String) -> String:
	var c = u.replace("http://localhost:8000", "")
	if c.begins_with("/custom_assets/"):
		return "res://assets/custom_asset_packs/" + c.substr(15)
	return c

func _spawn_compiled_3d_world() -> void:
	player_3d = MasterCombatControllerScript.new()
	player_3d.name = "PlayerHero"
	player_3d.position = Vector3(0, 0.25, 4.0)

	if "BALDUR" in genre_mode or "CRPG" in genre_mode:
		player_3d.set("active_genre", 0)
	elif "ULTIMA" in genre_mode or "IMMERSIVE" in genre_mode:
		player_3d.set("active_genre", 2)
	else:
		player_3d.set("active_genre", 1)

	var col = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.45
	cap.height = 1.8
	col.shape = cap
	col.position = Vector3(0, 0.9, 0)
	player_3d.add_child(col)

	var p_cfg: Dictionary = config.get("player_config", {})
	var p_res = _url_to_res(str(p_cfg.get("model_url", config.get("player_class_url", ""))))
	var player_rig = _load_model_safe(p_res, "res://assets/kaykit/adventurers/Knight.glb")
	player_3d.add_child(player_rig)
	add_child(player_3d)
	player_3d.call("bind_character_model", player_rig)

	player_3d.connect("stats_updated", _on_player_stats_updated)
	player_3d.connect("combat_banner_signal", _show_banner)

	if loot_weapons.size() > 0:
		player_3d.call("equip_weapon_glb", loot_weapons[0])

	hotbar_node = SpellAndSkillHotbarScript.new()
	hotbar_node.name = "SpellAndSkillHotbar"
	hotbar_node.set("player", player_3d)
	hotbar_node.connect("hotbar_activated", func(_idx: int, ability: String): _show_banner("✨ " + ability))
	add_child(hotbar_node)

	# Build Rooms
	var rooms: Array = config.get("rooms", [])
	for r_idx in range(rooms.size()):
		var room: Dictionary = rooms[r_idx]
		var r_node = Node3D.new()
		r_node.name = str(room.get("room_id", "room_" + str(r_idx + 1)))
		var oz = float(room.get("offset_z", -float(r_idx * 16)))
		r_node.position = Vector3(0, 0, oz)
		add_child(r_node)

		# Static Floor Collider so CharacterBody3D stands solidly
		var floor_body = StaticBody3D.new()
		var floor_col = CollisionShape3D.new()
		var floor_box = BoxShape3D.new()
		floor_box.size = Vector3(20.0, 0.4, 20.0)
		floor_col.shape = floor_box
		floor_col.position = Vector3(0, -0.2, 0)
		floor_body.add_child(floor_col)
		r_node.add_child(floor_body)

		var floor_res = _url_to_res(str(room.get("floor_asset_url", "")))
		for fx in [-6.0, -2.0, 2.0, 6.0]:
			for fz in [-6.0, -2.0, 2.0, 6.0]:
				var fl = _load_model_safe(floor_res, "res://assets/kaykit/dungeon/floor_tile_large.gltf.glb")
				fl.position = Vector3(fx, 0, fz)
				r_node.add_child(fl)

		var light = OmniLight3D.new()
		light.position = Vector3(0, 4.5, 0)
		light.light_color = Color.from_string(str(room.get("lighting", {}).get("torch_color_hex", "#ff7b29")), Color(1, 0.5, 0.2))
		light.light_energy = 2.6
		light.omni_range = 18.0
		r_node.add_child(light)

		# Spawn Interactive Props
		var props: Array = room.get("props", [])
		for p in props:
			var p_mesh = _load_model_safe(_url_to_res(str(p.get("asset_url", ""))), "res://assets/kaykit/dungeon/barrel_large.gltf.glb")
			var prop_body = InteractiveProp3DScript.new()
			prop_body.position = Vector3(float(p.get("x", 3.0)), 0, float(p.get("z", -2.0)))
			r_node.add_child(prop_body)
			prop_body.call("setup_prop", p, p_mesh)
			prop_body.connect("prop_stimulus_triggered", func(pdata: Dictionary, stim: String, _actor: String):
				_show_banner("🔥 SYSTEMIC AFFORDANCE: " + stim + " ON " + str(pdata.get("id", "Object")))
			)

		# Spawn Survey NPC / Covenant Shrine
		if room.has("npc") and typeof(room["npc"]) == TYPE_DICTIONARY:
			var npc_d: Dictionary = room["npc"]
			var npc_inst = _load_model_safe(_url_to_res(str(npc_d.get("asset_url", ""))), "res://assets/kaykit/adventurers/Mage.glb")
			npc_inst.position = Vector3(float(npc_d.get("x", -3.5)), 0, float(npc_d.get("z", 1.5)))
			var npc_lbl = Label3D.new()
			npc_lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			npc_lbl.position = Vector3(0, 2.3, 0)
			npc_lbl.font_size = 32
			npc_lbl.modulate = Color("#fbbf24")
			npc_lbl.text = "💬 [E] " + str(npc_d.get("name", "Oracle"))
			npc_inst.add_child(npc_lbl)
			r_node.add_child(npc_inst)
			npcs.append({"node": npc_inst, "data": npc_d, "world_pos": r_node.position + npc_inst.position})

		# Spawn Enemies
		var room_enemies: Array = room.get("enemies", [])
		for e_d in room_enemies:
			var e_mesh = _load_model_safe(_url_to_res(str(e_d.get("asset_url", ""))), "res://assets/kaykit/skeletons/Skeleton_Warrior.glb")
			if bool(e_d.get("is_boss", false)):
				e_mesh.scale = Vector3(1.35, 1.35, 1.35)
			var enemy_unit = EnemyUnit3DScript.new()
			enemy_unit.name = str(e_d.get("name", "Guardian"))
			enemy_unit.position = Vector3(float(e_d.get("x", 2.0)), 0.1, float(e_d.get("z", 0.0)))
			r_node.add_child(enemy_unit)
			enemy_unit.call("setup_enemy", e_d, e_mesh, player_3d)
			enemy_unit.connect("enemy_slain", func(ed: Dictionary, _wpos: Vector3):
				_show_banner("🏆 SLAIN: " + str(ed.get("name", "Guardian")) + " — Loot Added to [I] Inventory!")
			)

func _spawn_compiled_2d_world() -> void:
	world_2d_root = Node2D.new()
	world_2d_root.name = "World2DRoot"
	add_child(world_2d_root)

	var s2d: Dictionary = config.get("sprites_2d_config", {})
	var ground_res = _url_to_res(str(s2d.get("tileset_ground_url", "")))
	var ground_tex = load(ground_res) if ResourceLoader.exists(ground_res) else load("res://icon.svg")

	# Tiled 2D Floor
	for gx in range(-6, 7):
		for gy in range(-12, 5):
			var tile = Sprite2D.new()
			tile.texture = ground_tex
			tile.position = Vector2(640 + gx * 96, 420 + gy * 64)
			tile.scale = Vector2(0.45, 0.45)
			world_2d_root.add_child(tile)

	# 2D Player with World2DController
	player_2d = World2DControllerScript.new()
	player_2d.name = "Player2D"
	player_2d.position = Vector2(640, 480)
	world_2d_root.add_child(player_2d)

	var p_tex_res = _url_to_res(str(s2d.get("player_idle_url", "")))
	var sp = player_2d.get("sprite") as Sprite2D
	if ResourceLoader.exists(p_tex_res) and sp:
		sp.texture = load(p_tex_res)
		sp.scale = Vector2(0.65, 0.65)

	var cam2d = Camera2D.new()
	cam2d.enabled = true
	player_2d.add_child(cam2d)

	player_2d.connect("stats_2d_updated", func(hp_v: float, stam_v: float, torch_on: bool):
		hud_label.text = str(config.get("campaign_title", "2D Campaign")) + " | HP: " + str(int(hp_v)) + " | STAM: " + str(int(stam_v)) + " | Torch [3]: " + ("ON" if torch_on else "OFF")
	)
	player_2d.connect("action_2d_triggered", func(act: String, _pos: Vector2):
		_show_banner("⚔️ 2D ACTION: " + act)
		if act == "INTERACT":
			_try_interact_2d()
	)

func _on_player_stats_updated(hp_v: float, stam_v: float, mana_v: float, ap_v: int) -> void:
	var lock_txt = " | 🎯 LOCKED" if (player_3d and player_3d.get("locked_target") != null) else ""
	var wep_txt = " | ⚔️ " + str(player_3d.get("equipped_weapon_name")) if player_3d else ""
	hud_label.text = str(config.get("campaign_title", "Campaign")) + " | HP: " + str(int(hp_v)) + " | STAM: " + str(int(stam_v)) + " | MANA: " + str(int(mana_v)) + " | AP: " + str(ap_v) + wep_txt + lock_txt

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_I:
			inventory_panel.visible = not inventory_panel.visible
		elif event.keycode == KEY_E:
			_try_interact()
		elif modal_panel.visible and event.keycode in [KEY_1, KEY_2, KEY_3]:
			var idx = 0 if event.keycode == KEY_1 else (1 if event.keycode == KEY_2 else 2)
			_select_dialogue_option(idx)

func _try_interact() -> void:
	if not player_3d:
		_try_interact_2d()
		return
	for n in npcs:
		if player_3d.global_position.distance_to(n["world_pos"]) < 4.8:
			_open_npc_modal(n["data"])
			return
	for node in get_tree().get_nodes_in_group("interactive_props"):
		if node is Node3D and player_3d.global_position.distance_to(node.global_position) < 4.2:
			if node.has_method("apply_elemental_stimulus"):
				node.apply_elemental_stimulus("INTERACT", "player_01")
				return

func _try_interact_2d() -> void:
	var rooms: Array = config.get("rooms", [])
	if rooms.size() > 0 and rooms[0].has("npc"):
		_open_npc_modal(rooms[0]["npc"])

func _open_npc_modal(npc_data: Dictionary) -> void:
	active_npc = npc_data
	modal_panel.visible = true
	var opts: Array = active_npc.get("options", ["Option 1", "Option 2", "Option 3"])
	var txt = "💬 [" + str(active_npc.get("name", "Oracle")) + "] " + str(active_npc.get("question_text", "")) + "\n"
	for i in range(opts.size()):
		txt += "\nPress [" + str(i + 1) + "] -> " + str(opts[i])
	modal_text.text = txt

func _select_dialogue_option(idx: int) -> void:
	var roll = (randi() % 20) + 1
	var opts: Array = active_npc.get("options", ["Choice A", "Choice B", "Choice C"])
	var chosen = str(opts[idx]) if idx < opts.size() else "Choice"
	modal_text.text = "🎲 D20 Skill Check: " + str(roll) + " — Selected: '" + chosen + "' (Telemetry Synced!)"
	var wb = get_node_or_null("/root/WebBridge")
	if wb and wb.has_method("emit_telemetry_to_react"):
		wb.call("emit_telemetry_to_react", {
			"player_id": "godot_native_player",
			"question_id": str(active_npc.get("question_id", "q1")),
			"interaction_type": "D20_DIALOGUE",
			"selected_option": chosen,
			"metric_delta": float(roll),
			"weapon_equipped": str(player_3d.get("equipped_weapon_name")) if player_3d else "2D_Blade"
		})
	await get_tree().create_timer(1.2).timeout
	modal_panel.visible = false
