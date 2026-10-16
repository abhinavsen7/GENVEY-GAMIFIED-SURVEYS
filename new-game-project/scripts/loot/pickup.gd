class_name Pickup
extends Node3D
## World collectible. The Game node finds the nearest pickup in range, shows
## its prompt, and calls try_collect() on the interact key. try_collect()
## succeeds only once, so an effect can never be applied twice.

enum Kind { HEALTH, WEAPON, ENERGY, SURVEY }

const WeaponLib := preload("res://scripts/weapons/weapon_models.gd")

const INFO := {
	Kind.HEALTH: {"name": "Health Potion", "desc": "Restores 30% of maximum health.", "color": Color(1.0, 0.15, 0.2)},
	Kind.WEAPON: {"name": "Shadow Blade", "desc": "Weapon upgrade: +20% melee damage.", "color": Color(1.0, 0.55, 0.1)},
	Kind.ENERGY: {"name": "Energy Crystal", "desc": "Fully recharges the Shockwave.", "color": Color(0.45, 0.4, 1.0)},
	Kind.SURVEY: {"name": "Ancient Relic", "desc": "Collect to unlock a bonus reward.", "color": Color(1.0, 0.8, 0.25)},
}

@export var kind: Kind = Kind.HEALTH
@export var interact_radius := 2.2
@export var marker_radius := 6.0
var item_name := ""
var description := ""
var wave := 0
var collected := false
var _spin: Node3D
var _marker: MeshInstance3D
var _t := randf() * TAU

func setup(k: Kind, wave_number: int, name_override := "", desc_override := "") -> void:
	kind = k
	wave = wave_number
	item_name = name_override if name_override != "" else INFO[k].name
	description = desc_override if desc_override != "" else INFO[k].desc

func _ready() -> void:
	add_to_group("pickups")
	if item_name == "":
		setup(kind, wave)
	var c: Color = INFO[kind].color
	_spin = Node3D.new()
	_spin.position.y = 0.9
	add_child(_spin)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = c
	mat.emission_enabled = true
	mat.emission = c
	mat.emission_energy_multiplier = 3.0
	mat.metallic = 0.6
	match kind:
		Kind.HEALTH:
			# Glass bottle (transparent) with glowing red liquid and a cork.
			var glass := StandardMaterial3D.new()
			glass.albedo_color = Color(0.8, 0.9, 1.0, 0.25)
			glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			glass.metallic = 0.2
			glass.roughness = 0.05
			var flask := SphereMesh.new()
			flask.radius = 0.22
			flask.height = 0.44
			_add_mesh(flask, Vector3.ZERO, glass)
			var liquid := SphereMesh.new()
			liquid.radius = 0.18
			liquid.height = 0.3
			_add_mesh(liquid, Vector3(0, -0.04, 0), mat)
			var neck := CylinderMesh.new()
			neck.top_radius = 0.06
			neck.bottom_radius = 0.08
			neck.height = 0.2
			_add_mesh(neck, Vector3(0, 0.28, 0), glass)
			var cork := CylinderMesh.new()
			cork.top_radius = 0.065
			cork.bottom_radius = 0.055
			cork.height = 0.1
			var cm := StandardMaterial3D.new()
			cm.albedo_color = Color(0.45, 0.3, 0.18)
			cm.roughness = 1.0
			_add_mesh(cork, Vector3(0, 0.42, 0), cm)
		Kind.WEAPON:
			# The real weapon model, standing blade-up, with a golden aura overlay.
			var w := WeaponLib.build(item_name)
			w.rotation.x = -PI * 0.5
			w.position.y = -0.55
			_spin.add_child(w)
			var aura := StandardMaterial3D.new()
			aura.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			aura.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			aura.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
			aura.albedo_color = Color(1.0, 0.75, 0.3, 0.35)
			aura.grow = true
			aura.grow_amount = 0.02
			for m in w.find_children("*", "MeshInstance3D", true, false):
				(m as MeshInstance3D).material_overlay = aura
			_add_particles(c)
		Kind.ENERGY:
			# Faceted crystal cluster: one tall shard plus three smaller ones.
			for i in 4:
				var cr := PrismMesh.new()
				var big := i == 0
				cr.size = Vector3(0.3, 0.75, 0.3) if big else Vector3(0.16, 0.4, 0.16)
				var mi := _add_mesh(cr, Vector3.ZERO if big else Vector3(cos(i * 2.1) * 0.2, -0.2, sin(i * 2.1) * 0.2), mat)
				mi.rotation = Vector3(0, i * 0.8, 0 if big else 0.35)
			_add_particles(c)
		Kind.SURVEY:
			var orb := SphereMesh.new()
			orb.radius = 0.2
			orb.height = 0.4
			_add_mesh(orb, Vector3.ZERO, mat)
			# Ornate gold frame: outer and inner rings plus four spokes.
			var gold := StandardMaterial3D.new()
			gold.albedo_color = Color(0.85, 0.65, 0.25)
			gold.metallic = 1.0
			gold.roughness = 0.3
			for rr in [[0.4, 0.47], [0.27, 0.31]]:
				var ring := TorusMesh.new()
				ring.inner_radius = rr[0]
				ring.outer_radius = rr[1]
				var r := _add_mesh(ring, Vector3.ZERO, gold)
				r.rotation.x = PI * 0.5
			for i in 4:
				var spoke := BoxMesh.new()
				spoke.size = Vector3(0.04, 0.2, 0.04)
				var sp := _add_mesh(spoke, Vector3(cos(i * PI * 0.5) * 0.37, sin(i * PI * 0.5) * 0.37, 0), gold)
				sp.rotation.z = i * PI * 0.5 + PI * 0.5
			# Golden light beam rising from the relic.
			var beam := CylinderMesh.new()
			beam.top_radius = 0.25
			beam.bottom_radius = 0.4
			beam.height = 6.0
			var bm := StandardMaterial3D.new()
			bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
			bm.cull_mode = BaseMaterial3D.CULL_DISABLED
			bm.albedo_color = Color(1.0, 0.8, 0.3, 0.12)
			var bmi := MeshInstance3D.new()
			bmi.mesh = beam
			bmi.material_override = bm
			bmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			bmi.position.y = 3.0
			add_child(bmi)
			_add_particles(c)
	# Floating icon above the item.
	var icon := Label3D.new()
	icon.text = {Kind.HEALTH: "+", Kind.WEAPON: "ATK", Kind.ENERGY: "Q", Kind.SURVEY: "?"}[kind]
	icon.font_size = 96
	icon.outline_size = 18
	icon.pixel_size = 0.005
	icon.modulate = c.lightened(0.3)
	icon.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	icon.position.y = 1.9
	add_child(icon)
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = 2.5 if kind == Kind.SURVEY else 1.5
	l.omni_range = 4.0
	l.position.y = 1.0
	add_child(l)
	# Ground marker that appears when the player is near (used most by the relic).
	_marker = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.75
	tm.outer_radius = 0.85
	_marker.mesh = tm
	_marker.scale = Vector3(1, 0.05, 1)
	_marker.position.y = 0.05
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.albedo_color = c
	_marker.material_override = mm
	_marker.visible = false
	add_child(_marker)

func _add_mesh(m: Mesh, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.position = pos
	mi.material_override = mat
	_spin.add_child(mi)
	return mi

func _add_particles(c: Color) -> void:
	var p := GPUParticles3D.new()
	p.amount = 24
	p.lifetime = 1.6
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = 0.6
	pm.gravity = Vector3(0, 0.8, 0)
	pm.initial_velocity_max = 0.2
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.06, 0.06)
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	qm.albedo_color = c
	qm.emission_enabled = true
	qm.emission = c
	qm.emission_energy_multiplier = 6.0
	q.material = qm
	p.draw_pass_1 = q
	p.position.y = 0.8
	add_child(p)

func _process(delta: float) -> void:
	_t += delta
	_spin.rotation.y += delta * 1.8
	_spin.position.y = 0.9 + sin(_t * 2.5) * 0.12

## Distance check used by Game; also toggles the proximity marker.
func update_proximity(player_pos: Vector3) -> float:
	var d := global_position.distance_to(player_pos)
	_marker.visible = d < marker_radius and not collected
	return d

## Returns true only the first time. Disables the item immediately.
func try_collect() -> bool:
	if collected:
		return false
	collected = true
	remove_from_group("pickups")
	var t := create_tween().set_parallel(true)
	t.tween_property(_spin, "scale", Vector3.ONE * 0.01, 0.25)
	t.tween_property(_spin, "position:y", 2.0, 0.25)
	t.chain().tween_callback(queue_free)
	return true
