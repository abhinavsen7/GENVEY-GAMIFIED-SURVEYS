class_name FX
extends RefCounted
## Static combat-effect helpers. Materials/meshes are cached once so spawning
## effects does not allocate new resources every hit.

static var _spark_mat: ParticleProcessMaterial
static var _spark_mesh: QuadMesh
static var _burst_mat: ParticleProcessMaterial
static var _burst_mesh: SphereMesh
static var _ring_mesh: TorusMesh
static var _ghost_mesh: CapsuleMesh

static func _emissive(c: Color, energy := 4.0, alpha := 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(c, alpha)
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return m

static func _init_cache() -> void:
	if _spark_mat:
		return
	_spark_mat = ParticleProcessMaterial.new()
	_spark_mat.direction = Vector3(0, 1, 0)
	_spark_mat.spread = 180.0
	_spark_mat.initial_velocity_min = 4.0
	_spark_mat.initial_velocity_max = 9.0
	_spark_mat.gravity = Vector3(0, -14, 0)
	_spark_mat.scale_min = 0.5
	_spark_mat.scale_max = 1.2
	_spark_mesh = QuadMesh.new()
	_spark_mesh.size = Vector2(0.08, 0.08)
	var sm := _emissive(Color(1.0, 0.75, 0.3), 8.0)
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	_spark_mesh.material = sm
	_burst_mat = ParticleProcessMaterial.new()
	_burst_mat.direction = Vector3(0, 1, 0)
	_burst_mat.spread = 180.0
	_burst_mat.initial_velocity_min = 1.5
	_burst_mat.initial_velocity_max = 4.0
	_burst_mat.gravity = Vector3(0, 2.5, 0)
	_burst_mat.scale_min = 0.6
	_burst_mat.scale_max = 1.4
	_burst_mat.damping_min = 2.0
	_burst_mat.damping_max = 3.0
	_burst_mesh = SphereMesh.new()
	_burst_mesh.radius = 0.12
	_burst_mesh.height = 0.24
	_burst_mesh.material = _emissive(Color(0.6, 0.2, 1.0), 6.0)
	_ring_mesh = TorusMesh.new()
	_ring_mesh.inner_radius = 0.85
	_ring_mesh.outer_radius = 1.0
	_ghost_mesh = CapsuleMesh.new()
	_ghost_mesh.radius = 0.35
	_ghost_mesh.height = 1.7

static func _one_shot(parent: Node, pos: Vector3, pmat: ParticleProcessMaterial, mesh: Mesh, amount: int, life: float) -> void:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = amount
	p.lifetime = life
	p.process_material = pmat
	p.draw_pass_1 = mesh
	parent.add_child(p)
	p.global_position = pos
	p.emitting = true
	p.finished.connect(p.queue_free)

## Bright sparks + quick light flash at the impact point.
static func hit_sparks(parent: Node, pos: Vector3, heavy := false) -> void:
	_init_cache()
	_one_shot(parent, pos, _spark_mat, _spark_mesh, 40 if heavy else 18, 0.45)
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.7, 0.35)
	l.light_energy = 6.0 if heavy else 3.0
	l.omni_range = 4.0
	parent.add_child(l)
	l.global_position = pos
	var t := l.create_tween()
	t.tween_property(l, "light_energy", 0.0, 0.15)
	t.tween_callback(l.queue_free)

## Purple soul burst when an enemy dies.
static func death_burst(parent: Node, pos: Vector3) -> void:
	_init_cache()
	_one_shot(parent, pos, _burst_mat, _burst_mesh, 40, 1.2)

## Floating damage number (Label3D) that rises and fades.
static func damage_number(parent: Node, pos: Vector3, amount: float, crit := false) -> void:
	var lbl := Label3D.new()
	lbl.text = str(int(round(amount)))
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = true
	lbl.font_size = 96 if crit else 64
	lbl.outline_size = 16
	lbl.pixel_size = 0.004
	lbl.modulate = Color(1.0, 0.45, 0.2) if crit else Color(1, 0.95, 0.8)
	parent.add_child(lbl)
	lbl.global_position = pos + Vector3(randf_range(-0.3, 0.3), 0, randf_range(-0.3, 0.3))
	var t := lbl.create_tween().set_parallel(true)
	t.tween_property(lbl, "global_position:y", lbl.global_position.y + 1.2, 0.8).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	t.tween_property(lbl, "modulate:a", 0.0, 0.8).set_delay(0.3)
	t.chain().tween_callback(lbl.queue_free)

## Expanding magic ring used by the special ability.
static func shockwave(parent: Node, pos: Vector3, radius: float) -> void:
	_init_cache()
	var ring := MeshInstance3D.new()
	ring.mesh = _ring_mesh
	var m := _emissive(Color(0.55, 0.3, 1.0), 6.0, 0.9)
	ring.material_override = m
	parent.add_child(ring)
	ring.global_position = pos + Vector3(0, 0.3, 0)
	ring.scale = Vector3.ONE * 0.3
	var l := OmniLight3D.new()
	l.light_color = Color(0.6, 0.35, 1.0)
	l.light_energy = 10.0
	l.omni_range = radius * 1.5
	ring.add_child(l)
	var t := ring.create_tween().set_parallel(true)
	t.tween_property(ring, "scale", Vector3(radius, 1.5, radius), 0.35).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_EXPO)
	t.tween_property(m, "albedo_color:a", 0.0, 0.45)
	t.tween_property(l, "light_energy", 0.0, 0.45)
	t.chain().tween_callback(ring.queue_free)
	_one_shot(parent, pos + Vector3(0, 0.5, 0), _burst_mat, _burst_mesh, 50, 0.9)

## Fading afterimage left behind by a dodge.
static func afterimage(parent: Node, xform: Transform3D) -> void:
	_init_cache()
	var g := MeshInstance3D.new()
	g.mesh = _ghost_mesh
	var m := _emissive(Color(0.4, 0.6, 1.0), 2.0, 0.45)
	g.material_override = m
	parent.add_child(g)
	g.global_transform = xform
	g.position.y += 0.9
	var t := g.create_tween()
	t.tween_property(m, "albedo_color:a", 0.0, 0.3)
	t.tween_callback(g.queue_free)

## Global hit-stop: briefly slows time on powerful hits.
static func hit_stop(tree: SceneTree, duration := 0.06, scale := 0.05) -> void:
	Engine.time_scale = scale
	await tree.create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0
