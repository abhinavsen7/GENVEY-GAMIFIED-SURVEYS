class_name WeaponModels
extends RefCounted
## Builds detailed multi-part weapon models in code (no external assets).
## Models point along -Z from the grip at the origin, so they drop straight
## into the player's sword pivot (hand) and also into loot pickups.

const SPECS := {
	"Temple Sword": {"len": 1.15, "w": 0.08, "steel": Color(0.55, 0.6, 0.65), "rune": Color(0.4, 0.85, 1.0), "guard": 0.32, "grip": 0.22},
	"Ashen Edge": {"len": 1.4, "w": 0.11, "steel": Color(0.14, 0.14, 0.17), "rune": Color(1.0, 0.12, 0.12), "guard": 0.5, "grip": 0.32},
	"Shadow Blade": {"len": 1.2, "w": 0.09, "steel": Color(0.12, 0.12, 0.14), "rune": Color(1.0, 0.1, 0.08), "guard": 0.42, "grip": 0.24},
	"Great Sword": {"len": 1.75, "w": 0.17, "steel": Color(0.45, 0.45, 0.48), "rune": Color(1.0, 0.5, 0.1), "guard": 0.62, "grip": 0.42},
	"Dual Blades": {"len": 0.78, "w": 0.07, "steel": Color(0.2, 0.18, 0.24), "rune": Color(0.75, 0.3, 1.0), "guard": 0.24, "grip": 0.18},
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

## Returns one blade (grip at origin, tip toward -Z).
static func build(weapon_name: String) -> Node3D:
	var s: Dictionary = SPECS.get(weapon_name, SPECS["Temple Sword"])
	var root := Node3D.new()
	root.name = "Weapon"
	var steel := _mat(s.steel, 1.0, 0.22)
	var gold := _mat(Color(0.55, 0.42, 0.2), 1.0, 0.35)
	var leather := _mat(Color(0.18, 0.1, 0.06), 0.0, 0.9)
	var rune := _mat(s.rune, 0.0, 0.5, 5.0)
	var L: float = s.len
	var W: float = s.w
	var start := 0.12
	# Blade body, a thin glowing rune fuller on both faces, and a tapered tip.
	var blade := BoxMesh.new()
	blade.size = Vector3(W, W * 0.28, L)
	_part(root, blade, Vector3(0, 0, -start - L * 0.5), steel)
	var fuller := BoxMesh.new()
	fuller.size = Vector3(W * 0.28, W * 0.34, L * 0.78)
	_part(root, fuller, Vector3(0, 0, -start - L * 0.45), rune)
	var tip := PrismMesh.new()
	tip.size = Vector3(W, W * 2.2, W * 0.28)
	_part(root, tip, Vector3(0, 0, -start - L - W * 1.1), steel, Vector3(-PI * 0.5, 0, 0))
	# Ornate cross-guard with end caps and a central gem.
	var guard := BoxMesh.new()
	guard.size = Vector3(s.guard, 0.06, 0.08)
	_part(root, guard, Vector3(0, 0, -start + 0.02), gold)
	var cap := SphereMesh.new()
	cap.radius = 0.04
	cap.height = 0.08
	_part(root, cap, Vector3(s.guard * 0.5, 0, -start + 0.02), gold)
	_part(root, cap, Vector3(-s.guard * 0.5, 0, -start + 0.02), gold)
	var gem := SphereMesh.new()
	gem.radius = 0.035
	gem.height = 0.07
	_part(root, gem, Vector3(0, 0.04, -start + 0.02), rune)
	# Leather-wrapped grip and pommel.
	var grip := CylinderMesh.new()
	grip.top_radius = 0.028
	grip.bottom_radius = 0.032
	grip.height = s.grip
	_part(root, grip, Vector3(0, 0, -start + 0.04 + s.grip * 0.5), leather, Vector3(PI * 0.5, 0, 0))
	var pommel := SphereMesh.new()
	pommel.radius = 0.045
	pommel.height = 0.09
	_part(root, pommel, Vector3(0, 0, -start + 0.06 + s.grip), gold)
	return root

static func blade_length(weapon_name: String) -> float:
	return SPECS.get(weapon_name, SPECS["Temple Sword"]).len
