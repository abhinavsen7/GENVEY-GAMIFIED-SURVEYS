extends StaticBody3D
class_name InteractiveProp3D

var prop_data: Dictionary = {}
var is_activated: bool = false
var label_3d: Label3D = null

signal prop_stimulus_triggered(prop_data: Dictionary, stimulus: String, actor_id: String)

func setup_prop(data: Dictionary, mesh_node: Node3D) -> void:
	prop_data = data
	add_to_group("interactive_props")

	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(1.2, 1.2, 1.2)
	col.shape = box
	col.position = Vector3(0, 0.6, 0)
	add_child(col)

	add_child(mesh_node)

	var verb = str(data.get("affordance_verb", ""))
	if verb != "":
		label_3d = Label3D.new()
		label_3d.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label_3d.position = Vector3(0, 1.75, 0)
		label_3d.font_size = 28
		label_3d.modulate = Color("#38bdf8")
		label_3d.text = "[E] " + verb + " " + str(data.get("id", "Object"))
		add_child(label_3d)

func apply_elemental_stimulus(stimulus: String, actor_id: String) -> void:
	if is_activated:
		return
	is_activated = true
	if label_3d:
		label_3d.modulate = Color("#4ade80")
		label_3d.text = "✓ " + stimulus + " TRIGGERED!"
	emit_signal("prop_stimulus_triggered", prop_data, stimulus, actor_id)
	if stimulus == "FIRE":
		scale = Vector3(1.2, 0.4, 1.2)
	elif stimulus == "LOCKPICK":
		rotation_degrees.y += 75.0
