extends SceneTree

func _init() -> void:
	var args = OS.get_cmdline_user_args()
	if args.size() == 0:
		quit(0)
		return

	var cmd = args[0]
	var payload_str = args[1] if args.size() > 1 else "{}"
	var payload = JSON.parse_string(payload_str) if payload_str != "" else {}
	if typeof(payload) != TYPE_DICTIONARY:
		payload = {}

	match cmd:
		"inspect_gltf":
			_inspect_gltf(payload.get("res_path", ""))
		"build_kaykit_dungeon_scene":
			_build_kaykit_dungeon_scene(payload)
		"verify_project":
			print("MCP_JSON_START")
			print(JSON.stringify({"status": "ok", "engine": Engine.get_version_info()}))
			print("MCP_JSON_END")

	quit(0)

func _inspect_gltf(res_path: String) -> void:
	if not ResourceLoader.exists(res_path):
		print("MCP_JSON_START")
		print(JSON.stringify({"error": "Resource not found: " + res_path}))
		print("MCP_JSON_END")
		return
	var packed: PackedScene = load(res_path)
	if packed == null:
		print("MCP_JSON_START")
		print(JSON.stringify({"error": "Failed to load PackedScene: " + res_path}))
		print("MCP_JSON_END")
		return
	var inst = packed.instantiate()
	var result = {
		"res_path": res_path,
		"root_name": inst.name,
		"root_class": inst.get_class(),
		"bones": [],
		"animations": [],
		"meshes": []
	}
	_traverse_node(inst, inst, result)
	inst.free()
	print("MCP_JSON_START")
	print(JSON.stringify(result))
	print("MCP_JSON_END")

func _traverse_node(root: Node, node: Node, out: Dictionary) -> void:
	if node is Skeleton3D:
		for i in range(node.get_bone_count()):
			out["bones"].append(node.get_bone_name(i))
	elif node is AnimationPlayer:
		for anim_name in node.get_animation_list():
			var anim: Animation = node.get_animation(anim_name)
			out["animations"].append({"name": str(anim_name), "length": anim.length, "loop": anim.loop_mode})
	elif node is MeshInstance3D:
		out["meshes"].append(str(root.get_path_to(node)))

	for child in node.get_children():
		_traverse_node(root, child, out)

func _set_owner_recursive(node: Node, owner_node: Node) -> void:
	for child in node.get_children():
		child.owner = owner_node
		_set_owner_recursive(child, owner_node)

func _build_kaykit_dungeon_scene(config: Dictionary) -> void:
	var root = Node3D.new()
	root.name = "CompiledDungeonScene"

	# 1. Add WorldEnvironment with Dark Fantasy Volumetric Glow & Fog
	var env_node = WorldEnvironment.new()
	env_node.name = "WorldEnvironment"
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#08070c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#1e1b2e")
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.glow_enabled = true
	env.glow_intensity = 0.8
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.025
	env.volumetric_fog_albedo = Color("#161224")
	env_node.environment = env
	root.add_child(env_node)
	env_node.owner = root

	# 2. Add Directional Rim Light
	var dir_light = DirectionalLight3D.new()
	dir_light.name = "MoonRimLight"
	dir_light.light_color = Color("#818cf8")
	dir_light.light_energy = 1.15
	dir_light.shadow_enabled = true
	dir_light.rotation_degrees = Vector3(-48, 35, 0)
	root.add_child(dir_light)
	dir_light.owner = root

	# 3. Add NavigationRegion3D with baked/configured NavigationMesh
	var nav_region = NavigationRegion3D.new()
	nav_region.name = "DungeonNavigationRegion"
	var nav_mesh = NavigationMesh.new()
	nav_mesh.agent_radius = 0.45
	nav_mesh.agent_height = 1.8
	var vertices = PackedVector3Array([
		Vector3(-24, 0, -24),
		Vector3(24, 0, -24),
		Vector3(24, 0, 24),
		Vector3(-24, 0, 24)
	])
	nav_mesh.set_vertices(vertices)
	nav_mesh.add_polygon(PackedInt32Array([0, 1, 2, 3]))
	nav_region.navigation_mesh = nav_mesh
	root.add_child(nav_region)
	nav_region.owner = root

	# 4. Instantiate KayKit Floor, Pillars, Torch Lights, Hero Knight & Skeleton Boss if imported
	var spawned_assets = []
	var floor_path = "res://assets/kaykit/dungeon/floor_tile_large.gltf.glb"
	if ResourceLoader.exists(floor_path):
		var floor_packed: PackedScene = load(floor_path)
		if floor_packed:
			for gx in [-1, 0, 1]:
				for gz in [-1, 0, 1]:
					var tile = floor_packed.instantiate()
					tile.name = "FloorTile_%d_%d" % [gx, gz]
					tile.position = Vector3(gx * 4.0, 0.0, gz * 4.0)
					nav_region.add_child(tile)
					tile.owner = root
			spawned_assets.append(floor_path)

	var knight_path = "res://assets/kaykit/adventurers/Knight.glb"
	if ResourceLoader.exists(knight_path):
		var knight_packed: PackedScene = load(knight_path)
		if knight_packed:
			var hero = knight_packed.instantiate()
			hero.name = "HeroKnight"
			hero.position = Vector3(0, 0, 3.5)
			root.add_child(hero)
			hero.owner = root
			spawned_assets.append(knight_path)

	var skel_path = "res://assets/kaykit/skeletons/Skeleton_Warrior.glb"
	if ResourceLoader.exists(skel_path):
		var skel_packed: PackedScene = load(skel_path)
		if skel_packed:
			var boss = skel_packed.instantiate()
			boss.name = "SkeletonBoss"
			boss.position = Vector3(0, 0, -3.5)
			root.add_child(boss)
			boss.owner = root
			spawned_assets.append(skel_path)

	# 5. Pack and Save Valid .tscn via Godot's Native Serializer
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://scenes"))
	var packed = PackedScene.new()
	packed.pack(root)
	var save_path = config.get("save_path", "res://scenes/GeneratedDungeon.tscn")
	var err = ResourceSaver.save(packed, save_path)
	root.free()
	print("MCP_JSON_START")
	print(JSON.stringify({
		"status": "saved" if err == OK else "error",
		"error_code": err,
		"scene_path": save_path,
		"spawned_assets": spawned_assets
	}))
	print("MCP_JSON_END")
