extends Area3D
class_name ChemistryInteractiveProp

@export var prop_tags: Array[String] = ["Flammable", "Locked"]
@export var linked_survey_question_id: String = ""
@export var burn_survey_option: String = ""
@export var lockpick_survey_option: String = ""
@export var combat_smash_option: String = ""

var is_burning: bool = false
var is_unlocked: bool = false

func apply_elemental_stimulus(element: String, player_id: String) -> void:
	if element == "FIRE" and "Flammable" in prop_tags and not is_burning:
		is_burning = true
		TelemetryClient.send_implicit_choice(
			player_id,
			linked_survey_question_id,
			"CHEMISTRY_BURN",
			burn_survey_option,
			1.0
		)
		queue_free() # Obstacle burned away emergently

	elif element == "LOCKPICK" and "Locked" in prop_tags and not is_unlocked:
		is_unlocked = true
		TelemetryClient.send_implicit_choice(
			player_id,
			linked_survey_question_id,
			"STEALTH_LOCKPICK",
			lockpick_survey_option,
			1.0
		)
		queue_free()

	elif element == "SMASH" and "Destructible" in prop_tags:
		TelemetryClient.send_implicit_choice(
			player_id,
			linked_survey_question_id,
			"COMBAT_KILL",
			combat_smash_option,
			1.0
		)
		queue_free()
