extends CharacterBody2D
class_name World2DController

@export var speed: float = 160.0
@export var max_hp: float = 120.0
var hp: float = 120.0
var stamina: float = 100.0
var torch_enabled: bool = true

var sprite: Sprite2D = null
var torch_light: PointLight2D = null

signal stats_2d_updated(hp: float, stamina: float, torch_on: bool)
signal action_2d_triggered(action_type: String, world_pos: Vector2)

func _ready() -> void:
	sprite = get_node_or_null("Sprite2D") as Sprite2D
	if not sprite:
		sprite = Sprite2D.new()
		sprite.name = "Sprite2D"
		add_child(sprite)

	torch_light = get_node_or_null("PointLight2D") as PointLight2D
	if not torch_light:
		torch_light = PointLight2D.new()
		torch_light.name = "PointLight2D"
		torch_light.color = Color("#ff9e44")
		torch_light.energy = 1.35
		add_child(torch_light)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_3:
				torch_enabled = not torch_enabled
				if torch_light:
					torch_light.enabled = torch_enabled
				emit_signal("stats_2d_updated", hp, stamina, torch_enabled)
			KEY_E:
				emit_signal("action_2d_triggered", "INTERACT", global_position)
			KEY_G:
				emit_signal("action_2d_triggered", "GRAB_PROP", global_position)
			KEY_1:
				emit_signal("action_2d_triggered", "FIREBALL", global_position)
			KEY_2:
				emit_signal("action_2d_triggered", "FROST_NOVA", global_position)
			KEY_4:
				hp = min(max_hp, hp + 45.0)
				emit_signal("stats_2d_updated", hp, stamina, torch_enabled)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		emit_signal("action_2d_triggered", "MELEE_SLASH", global_position)

func _physics_process(delta: float) -> void:
	stamina = min(100.0, stamina + 18.0 * delta)
	var dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	velocity = dir * speed
	if dir.x != 0 and sprite:
		sprite.flip_h = dir.x < 0
	move_and_slide()
