extends Node3D

const BACKEND_URL = "http://localhost:8000"
var http_config: HTTPRequest
var http_glb: HTTPRequest
var player: UniversalPlayer
var dungeon_root: Node3D

var active_config: Dictionary = {}

func _ready() -> void:
	dungeon_root = get_node_or_null("DungeonRoot")
	if not dungeon_root:
		dungeon_root = Node3D.new()
		dungeon_root.name = "DungeonRoot"
		add_child(dungeon_root)

	http_config = get_node_or_null("HTTPConfigRequest")
	if not http_config:
		http_config = HTTPRequest.new()
		http_config.name = "HTTPConfigRequest"
		add_child(http_config)

	http_glb = get_node_or_null("HTTPGlbRequest")
	if not http_glb:
		http_glb = HTTPRequest.new()
		http_glb.name = "HTTPGlbRequest"
		add_child(http_glb)

	player = get_node_or_null("UniversalPlayer")

	http_config.request_completed.connect(_on_config_loaded)
	http_config.request(BACKEND_URL + "/api/game-config")

func _on_config_loaded(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if response_code != 200:
		print("[GameLoader] Failed to load config, status: ", response_code)
		return
	var parsed = JSON.parse_string(body.get_string_from_utf8())
	if typeof(parsed) == TYPE_DICTIONARY:
		rebuild_world_from_config(parsed)

func rebuild_world_from_config(config: Dictionary) -> void:
	active_config = config
	print("[GameLoader] Rebuilding KayKit 3D World for Build ID: ", config.get("build_id", "initial"))

	# 1. Clear existing room nodes
	for child in dungeon_root.get_children():
		child.queue_free()

	# 2. Build rooms from config["rooms"] or fallback to config["wfc_grid"]
	if config.has("rooms") and typeof(config["rooms"]) == TYPE_ARRAY and config["rooms"].size() > 0:
		_build_kaykit_rooms(config["rooms"])
	elif config.has("wfc_grid") and typeof(config["wfc_grid"]) == TYPE_ARRAY:
		build_3d_dungeon_from_grid(config["wfc_grid"])

	# 3. Configure Player KayKit Adventurer Class & AnimationTree State Machine
	var player_class_name: String = str(config.get("player_class", "Knight.glb"))
	_bind_character_animation_tree(player, player_class_name)

	# 4. Equip first forged 3D weapon
	if config.has("weapons") and typeof(config["weapons"]) == TYPE_ARRAY and config["weapons"].size() > 0:
		var first_weapon = config["weapons"][0]
		if typeof(first_weapon) == TYPE_DICTIONARY and first_weapon.has("glb_url"):
			download_and_equip_weapon(str(first_weapon["glb_url"]), str(first_weapon.get("shader_color_hex", "#ffffff")))

func _build_kaykit_rooms(rooms: Array) -> void:
	for r_idx in range(rooms.size()):
		var room: Dictionary = rooms[r_idx]
		var room_node = Node3D.new()
		room_node.name = str(room.get("room_id", "room_" + str(r_idx + 1)))
		var ox: float = float(room.get("offset_x", 0.0))
		var oz: float = float(room.get("offset_z", -float(r_idx * 16 + 8)))
		var rw: float = float(room.get("width", 16.0))
		var rd: float = float(room.get("depth", 16.0))
		room_node.position = Vector3(ox, 0.0, oz)
		dungeon_root.add_child(room_node)

		# Instantiate floor tiles & perimeter walls with trimesh collisions
		var half_w: float = rw * 0.5
		var half_d: float = rd * 0.5
		var x: float = -half_w + 2.0
		while x <= half_w - 2.0:
			var z: float = -half_d + 2.0
			while z <= half_d - 2.0:
				var floor_inst = _load_kaykit_mesh_or_box(
					str(room.get("floor_style", "floor_tile_large.gltf")),
					Vector3(4.0, 0.2, 4.0)
				)
				floor_inst.position = Vector3(x, 0.0, z)
				room_node.add_child(floor_inst)
				floor_inst.create_trimesh_collision()
				z += 4.0
			x += 4.0

		# West & East Perimeter Walls with Trimesh StaticBody3D
		var wz: float = -half_d + 2.0
		while wz <= half_d - 2.0:
			var west_wall = _load_kaykit_mesh_or_box(str(room.get("wall_style", "wall_arched.gltf")), Vector3(1.0, 4.0, 4.0))
			west_wall.position = Vector3(-half_w, 0.0, wz)
			room_node.add_child(west_wall)
			west_wall.create_trimesh_collision()

			var east_wall = _load_kaykit_mesh_or_box(str(room.get("wall_style", "wall_arched.gltf")), Vector3(1.0, 4.0, 4.0))
			east_wall.position = Vector3(half_w, 0.0, wz)
			room_node.add_child(east_wall)
			east_wall.create_trimesh_collision()
			wz += 4.0

		# Torch OmniLight3D
		var omni = OmniLight3D.new()
		omni.position = Vector3(0.0, 3.2, 0.0)
		omni.light_color = Color.from_string(str(room.get("lighting", {}).get("torch_color_hex", "#ff7b29")), Color(1.0, 0.5, 0.2))
		omni.light_energy = 2.5
		omni.omni_range = 16.0
		room_node.add_child(omni)

		# Spawn KayKit Skeleton Enemies with AnimationTree State Machine
		var enemies: Array = room.get("enemies", [])
		for e_idx in range(enemies.size()):
			var e_cfg: Dictionary = enemies[e_idx]
			var enemy_ai = SurveyBossAI.new()
			enemy_ai.name = str(e_cfg.get("enemy_id", "enemy_" + str(e_idx)))
			enemy_ai.enemy_name = str(e_cfg.get("name", "Skeleton_Warrior"))
			enemy_ai.max_health = float(e_cfg.get("hp", 120.0))
			enemy_ai.health = enemy_ai.max_health
			enemy_ai.max_poise = float(e_cfg.get("poise", 60.0))
			enemy_ai.poise = enemy_ai.max_poise
			enemy_ai.linked_question_id = str(e_cfg.get("question_id", "q1_risk"))
			enemy_ai.combat_option_mapped = str(e_cfg.get("mapped_option", "Aggressive Resolution"))
			enemy_ai.position = Vector3(float(e_cfg.get("x", 2.0)), 0.0, float(e_cfg.get("z", 0.0)))
			room_node.add_child(enemy_ai)
			_bind_character_animation_tree(enemy_ai, str(e_cfg.get("archetype", "Skeleton_Warrior.glb")))

func _load_kaykit_mesh_or_box(asset_name: String, fallback_size: Vector3) -> MeshInstance3D:
	var clean_name = asset_name if asset_name.ends_with(".glb") else asset_name + ".glb"
	var candidate_paths = [
		"res://assets/custom_asset_packs/environments/ModularCastle_AssetPack/Floors&Ramps/Floors/" + clean_name,
		"res://assets/custom_asset_packs/environments/ModularCastle_AssetPack/Walls/Walls_Variable_Height/" + clean_name,
		"res://assets/kaykit/dungeon/" + clean_name,
		"res://assets/kaykit/dungeon/floor_tile_large.gltf.glb" if "floor" in asset_name.to_lower() else "res://assets/kaykit/dungeon/wall.gltf.glb"
	]
	for p in candidate_paths:
		if ResourceLoader.exists(p):
			var res = load(p)
			if res is PackedScene:
				var inst = res.instantiate()
				if inst is MeshInstance3D:
					return inst
				for c in inst.get_children():
					if c is MeshInstance3D:
						c.owner = null
						inst.remove_child(c)
						inst.queue_free()
						return c
				inst.queue_free()
	var fallback = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = fallback_size
	fallback.mesh = box
	return fallback

func _bind_character_animation_tree(target_node: Node, model_name: String) -> void:
	if not target_node:
		return
	var clean_base = model_name.replace(".glb", "").replace(".gltf", "")
	var char_paths = [
		"res://assets/custom_asset_packs/characters/fantasy_outfits/" + clean_base + ".gltf",
		"res://assets/custom_asset_packs/characters/" + clean_base + ".glb",
		"res://assets/kaykit/adventurers/" + clean_base + ".glb",
		"res://assets/kaykit/skeletons/" + clean_base + ".glb",
		"res://assets/kaykit/adventurers/Knight.glb",
		"res://assets/kaykit/skeletons/Skeleton_Warrior.glb"
	]
	var char_inst: Node = null
	for cp in char_paths:
		if ResourceLoader.exists(cp):
			var packed: PackedScene = load(cp)
			if packed:
				char_inst = packed.instantiate()
				char_inst.name = "CustomPackCharacterRig"
				target_node.add_child(char_inst)
				break

	if char_inst:
		for dup_path in [
			"Rig/Skeleton3D/handslot_l/1H_Sword_Offhand",
			"Rig/Skeleton3D/handslot_l/Rectangle_Shield",
			"Rig/Skeleton3D/handslot_l/Round_Shield",
			"Rig/Skeleton3D/handslot_l/Spike_Shield",
			"Rig/Skeleton3D/handslot_r/2H_Sword"
		]:
			var dup_node = char_inst.get_node_or_null(dup_path)
			if dup_node and dup_node is Node3D:
				dup_node.visible = false

		var skel: Skeleton3D = char_inst.get_node_or_null("Rig/Skeleton3D")
		if skel:
			for bname in ["hand_r", "handslot.r", "hand.r"]:
				if skel.find_bone(bname) != -1:
					var socket = BoneAttachment3D.new()
					socket.name = "RightHandSocket"
					socket.bone_name = bname
					skel.add_child(socket)
					break

	var anim_tree = target_node.get_node_or_null("AnimationTree")
	if not anim_tree:
		anim_tree = AnimationTree.new()
		anim_tree.name = "AnimationTree"
		var state_machine = AnimationNodeStateMachine.new()
		for clip_name in [
			"Idle",
			"Sword_Idle",
			"Walking_A",
			"Running_A",
			"Jog_Fwd_Loop",
			"1H_Melee_Attack_Slice_Diagonal",
			"Sword_Regular_A",
			"1H_Melee_Attack_Chop",
			"Dodge_Forward",
			"Roll",
			"Hit_A",
			"Death_A"
		]:
			var anim_node = AnimationNodeAnimation.new()
			anim_node.animation = clip_name
			state_machine.add_node(clip_name, anim_node)
		anim_tree.tree_root = state_machine
		target_node.add_child(anim_tree)
		if char_inst:
			var anim_player: AnimationPlayer = char_inst.get_node_or_null("AnimationPlayer")
			if anim_player:
				anim_tree.anim_player = anim_tree.get_path_to(anim_player)
				if anim_player.has_animation("Idle"):
					anim_player.play("Idle")
				elif anim_player.has_animation("Sword_Idle"):
					anim_player.play("Sword_Idle")
	print("[GameLoader] Bound Custom Asset Pack Skeleton3D & AnimationTree state machine for ", model_name)

func build_3d_dungeon_from_grid(grid: Array) -> void:
	var tile_size = 4.0
	for z in range(grid.size()):
		var row = grid[z]
		for x in range(row.size()):
			var cell = int(row[x])
			var pos = Vector3(x * tile_size, 0, z * tile_size)
			spawn_modular_tile(cell, pos)

func spawn_modular_tile(cell_type: int, pos: Vector3) -> void:
	var floor_mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(4.0, 0.2, 4.0)
	floor_mesh.mesh = box
	floor_mesh.position = pos
	dungeon_root.add_child(floor_mesh)
	floor_mesh.create_trimesh_collision()

	if cell_type == 1:
		var w_mesh = MeshInstance3D.new()
		var w_box = BoxMesh.new()
		w_box.size = Vector3(4.0, 4.0, 4.0)
		w_mesh.mesh = w_box
		w_mesh.position = pos + Vector3(0, 2.0, 0)
		dungeon_root.add_child(w_mesh)
		w_mesh.create_trimesh_collision()

func download_and_equip_weapon(glb_url: String, color_hex: String) -> void:
	http_glb.request_completed.connect(
		func(_r, code, _h, glb_bytes):
			if code == 200 and player:
				player.equip_runtime_glb_weapon(glb_bytes, color_hex)
			else:
				print("[GameLoader] Weapon GLB downloaded (code: ", code, ")"),
		CONNECT_ONE_SHOT
	)
	http_glb.request(glb_url)
