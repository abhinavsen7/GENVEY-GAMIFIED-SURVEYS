class_name Arena
extends NavigationRegion3D
## Builds the ruined temple arena at runtime from simple geometry, then bakes
## the navigation mesh from its static colliders so enemies can path around
## pillars and rubble. Collision layer 1 = world.

signal portal_entered

@export var half_size := 20.0
@export var wall_height := 6.0

var player_spawn := Vector3(0, 0.1, 14)
var spawn_points: Array[Vector3] = []
var _torches: Array[OmniLight3D] = []
var _torch_base: Array[float] = []
var _time := 0.0
var _stone: StandardMaterial3D
var _portal_mat: StandardMaterial3D
var _portal_light: OmniLight3D
var _portal_active := false

func _ready() -> void:
	_make_materials()
	_build()
	var nm := NavigationMesh.new()
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.geometry_collision_mask = 1
	nm.agent_radius = 0.6
	nm.agent_height = 1.8
	nm.agent_max_climb = 0.3
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	navigation_mesh = nm
	bake_navigation_mesh(false)
	for i in 8:
		var a := TAU * i / 8.0 + 0.2
		spawn_points.append(Vector3(cos(a) * 8.0, 0.2, sin(a) * 8.0 - 2.0))

func _make_materials() -> void:
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_CELLULAR
	noise.frequency = 0.02
	var alb := NoiseTexture2D.new()
	alb.noise = noise
	alb.seamless = true
	var grad := Gradient.new()
	grad.set_color(0, Color(0.13, 0.12, 0.13))
	grad.set_color(1, Color(0.36, 0.33, 0.32))
	alb.color_ramp = grad
	var nrm := NoiseTexture2D.new()
	nrm.noise = noise
	nrm.seamless = true
	nrm.as_normal_map = true
	nrm.bump_strength = 6.0
	_stone = StandardMaterial3D.new()
	_stone.albedo_texture = alb
	_stone.normal_enabled = true
	_stone.normal_texture = nrm
	_stone.roughness = 0.9
	_stone.uv1_triplanar = true
	_stone.uv1_scale = Vector3(0.25, 0.25, 0.25)

var _inv_mat: StandardMaterial3D
## Fully transparent material for collider boxes that sit under library meshes.
func _invisible() -> StandardMaterial3D:
	if _inv_mat == null:
		_inv_mat = StandardMaterial3D.new()
		_inv_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_inv_mat.albedo_color = Color(0, 0, 0, 0)
	return _inv_mat

func _box(pos: Vector3, size: Vector3, rot := Vector3.ZERO, mat: Material = null) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.collision_layer = 1
	b.collision_mask = 0
	b.position = pos
	b.rotation = rot
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat if mat else _stone
	b.add_child(mi)
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	b.add_child(cs)
	add_child(b)
	return b

func _pillar(pos: Vector3, h: float, broken: bool) -> void:
	var b := StaticBody3D.new()
	b.position = pos
	if broken or not ResourceLoader.exists(LIB + "pillar-large-01.glb"):
		var mi := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.7
		cm.bottom_radius = 0.8
		cm.height = h
		mi.mesh = cm
		mi.material_override = _stone
		mi.position.y = h * 0.5
		b.add_child(mi)
	else:
		# Library stone column (1 x 6 m) scaled to the collider's size.
		var col := (load(LIB + "pillar-large-01.glb") as PackedScene).instantiate() as Node3D
		col.scale = Vector3(1.6, h / 6.0, 1.6)
		b.add_child(col)
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 0.8
	sh.height = h
	cs.shape = sh
	cs.position.y = h * 0.5
	b.add_child(cs)
	add_child(b)
	_box(pos + Vector3(0, 0.15, 0), Vector3(2.0, 0.3, 2.0))
	if broken:
		# Fallen chunk lying next to the stump.
		_box(pos + Vector3(1.6, 0.5, 0.6), Vector3(1.0, 1.0, 2.6), Vector3(0, randf() * PI, 0.1))
	else:
		_box(pos + Vector3(0, h + 0.2, 0), Vector3(2.0, 0.4, 2.0))

const LIB := "res://assets/library/dungeon-dark-fantasy/"

## Instances a library GLB as decoration (collision comes from our own shapes).
func _deco(file: String, pos: Vector3, scl: Vector3, rot_y := 0.0) -> Node3D:
	if not ResourceLoader.exists(LIB + file):
		return null
	var n := (load(LIB + file) as PackedScene).instantiate() as Node3D
	n.position = pos
	n.scale = scl
	n.rotation.y = rot_y
	add_child(n)
	return n

func _torch(pos: Vector3) -> void:
	# Bronze brazier on the floor (2 m tall) with the flame in its bowl.
	var inward := -Vector3(signf(pos.x) if absf(pos.x) > 15.0 else 0.0, 0, signf(pos.z) if absf(pos.z) > 15.0 else 0.0) * 0.6
	pos += inward
	if _deco("brazier.glb", Vector3(pos.x, 0, pos.z), Vector3(2, 2, 2)) == null:
		_box(pos, Vector3(0.3, 0.6, 0.3))
	else:
		_box(Vector3(pos.x, 1.0, pos.z), Vector3(0.6, 2.0, 0.6), Vector3.ZERO, _invisible())
	var fire := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.18
	sm.height = 0.4
	fire.mesh = sm
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.albedo_color = Color(1.0, 0.55, 0.15)
	fm.emission_enabled = true
	fm.emission = Color(1.0, 0.5, 0.1)
	fm.emission_energy_multiplier = 8.0
	fire.material_override = fm
	fire.position = pos + Vector3(0, 0.5, 0)
	add_child(fire)
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.55, 0.25)
	l.light_energy = 2.5
	l.omni_range = 9.0
	l.position = pos + Vector3(0, 0.8, 0)
	add_child(l)
	_torches.append(l)
	_torch_base.append(randf() * 10.0)

func _build() -> void:
	var s := half_size
	# Floor (thick slab so nothing falls through).
	_box(Vector3(0, -0.5, 0), Vector3(s * 2, 1.0, s * 2))
	# Perimeter walls with uneven ruined tops.
	for i in 8:
		var x := -s + s * 0.25 * i + s * 0.125
		var h1 := wall_height - randf() * 2.0
		var h2 := wall_height - randf() * 2.0
		_box(Vector3(x, h1 * 0.5, -s), Vector3(s * 0.25, h1, 1.0))
		_box(Vector3(x, h2 * 0.5, s), Vector3(s * 0.25, h2, 1.0))
		var h3 := wall_height - randf() * 2.0
		var h4 := wall_height - randf() * 2.0
		_box(Vector3(-s, h3 * 0.5, x), Vector3(1.0, h3, s * 0.25))
		_box(Vector3(s, h4 * 0.5, x), Vector3(1.0, h4, s * 0.25))
	# Pillar ring around the central combat area.
	for i in 8:
		var a := TAU * i / 8.0 + PI / 8.0
		_pillar(Vector3(cos(a) * 12.5, 0, sin(a) * 12.5), 2.0 + randf() * 1.5 if i % 3 == 0 else 6.0, i % 3 == 0)
	# Scattered rubble / obstacles.
	_box(Vector3(-6, 0.5, 6), Vector3(2.2, 1.0, 1.4), Vector3(0, 0.4, 0))
	_box(Vector3(7, 0.4, -7), Vector3(1.6, 0.8, 2.4), Vector3(0, -0.6, 0))
	_box(Vector3(5.5, 0.6, 7.5), Vector3(1.2, 1.2, 1.2), Vector3(0.2, 0.8, 0))
	_box(Vector3(-8, 0.35, -5), Vector3(3.0, 0.7, 1.0), Vector3(0, 1.1, 0.1))
	# Stone coffins as crypt obstacles (collision from boxes).
	for cp in [Vector3(-14, 0, 9), Vector3(14, 0, -10)]:
		if _deco("coffin.glb", cp, Vector3(1.4, 1.4, 1.4), 0.3) != null:
			_box(cp + Vector3(0, 0.35, 0), Vector3(2.6, 0.7, 1.0), Vector3(0, 0.3, 0), _invisible())
	# Torches along the walls.
	for p in [Vector3(-10, 1.5, -19.2), Vector3(10, 1.5, -19.2), Vector3(-10, 1.5, 19.2), Vector3(10, 1.5, 19.2),
			Vector3(-19.2, 1.5, -6), Vector3(-19.2, 1.5, 6), Vector3(19.2, 1.5, -6), Vector3(19.2, 1.5, 6)]:
		_torch(p)
	# Central corrupted sigil (decorative, glowing).
	var sigil := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 4.6
	tm.outer_radius = 4.9
	tm.rings = 64
	sigil.mesh = tm
	sigil.scale = Vector3(1, 0.05, 1)
	sigil.position.y = 0.02
	var sgm := StandardMaterial3D.new()
	sgm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sgm.albedo_color = Color(0.5, 0.15, 0.9)
	sgm.emission_enabled = true
	sgm.emission = Color(0.5, 0.15, 0.9)
	sgm.emission_energy_multiplier = 3.0
	sigil.material_override = sgm
	add_child(sigil)
	var sl := OmniLight3D.new()
	sl.light_color = Color(0.55, 0.25, 1.0)
	sl.light_energy = 1.5
	sl.omni_range = 10.0
	sl.position = Vector3(0, 1.0, -2)
	add_child(sl)
	_build_portal()

func _build_portal() -> void:
	var z := -18.6
	_box(Vector3(-2.2, 2.5, z), Vector3(0.8, 5.0, 0.8))
	_box(Vector3(2.2, 2.5, z), Vector3(0.8, 5.0, 0.8))
	_box(Vector3(0, 5.2, z), Vector3(5.4, 0.8, 1.0))
	var plane := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(3.6, 4.8)
	plane.mesh = qm
	plane.position = Vector3(0, 2.5, z + 0.1)
	_portal_mat = StandardMaterial3D.new()
	_portal_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_portal_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_portal_mat.albedo_color = Color(0.3, 0.1, 0.1, 0.5)
	_portal_mat.emission_enabled = true
	_portal_mat.emission = Color(0.6, 0.05, 0.05)
	_portal_mat.emission_energy_multiplier = 1.0
	plane.material_override = _portal_mat
	add_child(plane)
	_portal_light = OmniLight3D.new()
	_portal_light.light_color = Color(0.9, 0.15, 0.1)
	_portal_light.light_energy = 2.0
	_portal_light.omni_range = 8.0
	_portal_light.position = Vector3(0, 2.5, z + 1.5)
	add_child(_portal_light)
	var area := Area3D.new()
	area.collision_layer = 0
	area.collision_mask = 2
	area.position = Vector3(0, 1.5, z + 1.2)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(3.6, 3.0, 1.5)
	cs.shape = bs
	area.add_child(cs)
	add_child(area)
	area.body_entered.connect(_on_portal_body)

## Opens the exit portal (sealed red -> bright blue-white) after the final wave.
func activate_portal() -> void:
	_portal_active = true
	var t := create_tween().set_parallel(true)
	t.tween_property(_portal_mat, "albedo_color", Color(0.5, 0.8, 1.0, 0.8), 1.0)
	t.tween_property(_portal_mat, "emission", Color(0.4, 0.75, 1.0), 1.0)
	t.tween_property(_portal_mat, "emission_energy_multiplier", 5.0, 1.0)
	t.tween_property(_portal_light, "light_color", Color(0.5, 0.8, 1.0), 1.0)
	t.tween_property(_portal_light, "light_energy", 8.0, 1.0)

func _on_portal_body(body: Node) -> void:
	if _portal_active and body is Player:
		portal_entered.emit()

func _process(delta: float) -> void:
	_time += delta
	for i in _torches.size():
		var b := _torch_base[i]
		_torches[i].light_energy = 2.4 + sin(_time * 9.0 + b) * 0.3 + sin(_time * 23.0 + b * 2.0) * 0.2
