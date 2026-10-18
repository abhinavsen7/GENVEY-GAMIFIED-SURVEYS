extends CharacterBody3D
class_name SurveyBossAI

@export var enemy_name: String = "Inquisitor Sentinel"
@export var linked_question_id: String = "q1"
@export var combat_option_mapped: String = "Direct Aggressive Resolution"
@export var max_health: float = 120.0
@export var max_poise: float = 60.0

var health: float = 120.0
var poise: float = 60.0
var is_staggered: bool = false
var target_player: Node3D = null

func _ready() -> void:
	health = max_health
	poise = max_poise
	add_to_group("enemies")
	if not target_player:
		target_player = get_tree().get_first_node_in_group("player")

func _physics_process(delta: float) -> void:
	if is_staggered or health <= 0.0:
		return
	poise = min(max_poise, poise + 5.0 * delta)
	if not target_player:
		target_player = get_tree().get_first_node_in_group("player")
	if target_player:
		var dist = global_position.distance_to(target_player.global_position)
		if dist < 12.0 and dist > 1.8:
			var dir = (target_player.global_position - global_position).normalized()
			velocity.x = dir.x * 3.2
			velocity.z = dir.z * 3.2
			look_at(Vector3(target_player.global_position.x, global_position.y, target_player.global_position.z), Vector3.UP)
			move_and_slide()

func apply_weapon_hit(damage: float, poise_damage: float, player_id: String) -> void:
	health -= damage
	poise -= poise_damage
	if poise <= 0.0 and not is_staggered:
		trigger_poise_stagger()
	if health <= 0.0:
		TelemetryClient.send_implicit_choice(
			player_id,
			linked_question_id,
			"COMBAT_KILL",
			combat_option_mapped,
			1.0
		)
		queue_free()

func trigger_poise_stagger() -> void:
	is_staggered = true
	poise = max_poise
	await get_tree().create_timer(1.5).timeout
	is_staggered = false
