class_name Health
extends Node
## Reusable health component. Owners call take_damage(); listeners use the signals.

signal changed(current: float, maximum: float)
signal damaged(amount: float, source_pos: Vector3, stagger_power: int)
signal died

@export var max_health: float = 100.0
var current: float
## While true, take_damage() is ignored (dodge i-frames, post-hit grace).
var invulnerable := false
var dead := false

func _ready() -> void:
	current = max_health

func reset(new_max: float = -1.0) -> void:
	if new_max > 0.0:
		max_health = new_max
	current = max_health
	dead = false
	changed.emit(current, max_health)

## Returns true if damage was applied.
func take_damage(amount: float, source_pos: Vector3 = Vector3.ZERO, stagger_power: int = 1) -> bool:
	if dead or invulnerable or amount <= 0.0:
		return false
	current = maxf(current - amount, 0.0)
	changed.emit(current, max_health)
	damaged.emit(amount, source_pos, stagger_power)
	if current <= 0.0:
		dead = true
		died.emit()
	return true

func heal(amount: float) -> void:
	if dead:
		return
	current = minf(current + amount, max_health)
	changed.emit(current, max_health)

func ratio() -> float:
	return current / max_health if max_health > 0.0 else 0.0
