class_name WeaponModels
extends RefCounted
## Builds detailed multi-part weapon models in code (no external assets).
## Models point along -Z with the grip centered at the origin (z=0), so they drop
## straight into the player's sword socket and align naturally inside the palm.

const SPECS := {
	"Temple Sword": {"len": 0.90, "w": 0.055, "steel": Color(0.55, 0.6, 0.65), "rune": Color(0.4, 0.85, 1.0), "guard": 0.22, "grip": 0.16},
	"Ashen Edge": {"len": 0.98, "w": 0.065, "steel": Color(0.14, 0.14, 0.17), "rune": Color(1.0, 0.14, 0.14), "guard": 0.24, "grip": 0.18},
	"Shadow Blade": {"len": 0.92, "w": 0.060, "steel": Color(0.12, 0.12, 0.14), "rune": Color(1.0, 0.1, 0.08), "guard": 0.22, "grip": 0.16},
	"Great Sword": {"len": 1.18, "w": 0.085, "steel": Color(0.45, 0.45, 0.48), "rune": Color(1.0, 0.5, 0.1), "guard": 0.30, "grip": 0.22},
	"Dual Blades": {"len": 0.65, "w": 0.050, "steel": Color(0.2, 0.18, 0.24), "rune": Color(0.75, 0.3, 1.0), "guard": 0.16, "grip": 0.14},
}

static func _mat(c: Color, metal: float, rough: float, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = metal
	m.roughness = rough
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

static func _part(root: Node3D, mesh: Mesh, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.rotation = rot
	mi.material_override = mat
	root.add_child(mi)
	return mi

static func rune_color(weapon_name: String) -> Color:
	return SPECS.get(weapon_name, SPECS["Temple Sword"]).rune

## Returns one blade (grip centered at origin z=0, tip toward -Z).
static func build(weapon_name: String) -> Node3D:
	var s: Dictionary = SPECS.get(weapon_name, SPECS["Temple Sword"])
	var root := Node3D.new()
	root.name = "Weapon"
	var steel := _mat(s.steel, 1.0, 0.20)
	var gold := _mat(Color(0.65, 0.50, 0.22), 1.0, 0.30)
	var leather := _mat(Color(0.18, 0.11, 0.06), 0.1, 0.85)
	var rune := _mat(s.rune, 0.0, 0.4, 4.5)
	var L: float = s.len
	var W: float = s.w
	var blade_thick: float = 0.014
	var guard_z: float = -0.055
	var blade_start: float = -0.07

	# Blade body: sleek, tapered steel edge with glowing rune fuller
	var blade := BoxMesh.new()
	blade.size = Vector3(W, blade_thick, L)
	_part(root, blade, Vector3(0, 0, blade_start - L * 0.5), steel)

	var fuller := BoxMesh.new()
	fuller.size = Vector3(W * 0.28, blade_thick * 1.25, L * 0.82)
	_part(root, fuller, Vector3(0, 0, blade_start - L * 0.46), rune)

	var tip := PrismMesh.new()
	tip.size = Vector3(W, W * 1.4, blade_thick)
	_part(root, tip, Vector3(0, 0, blade_start - L - W * 0.7), steel, Vector3(-PI * 0.5, 0, 0))

	# Ornate cross-guard: elegant, proportional width with spherical finials and center rune gem
	var guard := BoxMesh.new()
	guard.size = Vector3(s.guard, 0.024, 0.032)
	_part(root, guard, Vector3(0, 0, guard_z), gold)

	var cap := SphereMesh.new()
	cap.radius = 0.018
	cap.height = 0.036
	_part(root, cap, Vector3(s.guard * 0.5, 0, guard_z), gold)
	_part(root, cap, Vector3(-s.guard * 0.5, 0, guard_z), gold)

	var gem := SphereMesh.new()
	gem.radius = 0.016
	gem.height = 0.032
	_part(root, gem, Vector3(0, 0.018, guard_z), rune)

	# Leather-wrapped grip: fits comfortably inside the hand palm
	var grip := CylinderMesh.new()
	grip.top_radius = 0.014
	grip.bottom_radius = 0.016
	grip.height = s.grip
	_part(root, grip, Vector3(0, 0, guard_z + 0.016 + s.grip * 0.5), leather, Vector3(PI * 0.5, 0, 0))

	# Weighted pommel at the base of the grip
	var pommel := SphereMesh.new()
	pommel.radius = 0.022
	pommel.height = 0.044
	_part(root, pommel, Vector3(0, 0, guard_z + 0.024 + s.grip), gold)

	return root

static func blade_length(weapon_name: String) -> float:
	return SPECS.get(weapon_name, SPECS["Temple Sword"]).len
