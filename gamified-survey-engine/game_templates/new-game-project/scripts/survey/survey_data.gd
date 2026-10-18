class_name SurveyData
extends RefCounted
## Survey DEFINITIONS only (no player answers live here). Add questions by
## appending to QUESTIONS; bump VERSION when wording/ids change.
## "score" is optional and used by local analytics for averages.

const SURVEY_ID := "relic_wave_feedback"
const VERSION := 1

const QUESTIONS := [
	{"id": "combat_enjoyment", "text": "How enjoyable was the combat in this wave?", "answers": [
		{"id": "extremely", "text": "Extremely enjoyable", "score": 4},
		{"id": "very", "text": "Very enjoyable", "score": 3},
		{"id": "somewhat", "text": "Somewhat enjoyable", "score": 2},
		{"id": "not", "text": "Not enjoyable", "score": 1}]},
	{"id": "weapon_preference", "text": "Which weapon would you prefer to use?", "answers": [
		{"id": "dual_blades", "text": "Fast dual blades"},
		{"id": "greatsword", "text": "Heavy greatsword"},
		{"id": "magic", "text": "Magical weapon"},
		{"id": "balanced", "text": "Balanced sword"}]},
	{"id": "difficulty", "text": "How difficult was the wave?", "answers": [
		{"id": "too_easy", "text": "Too easy", "score": 1},
		{"id": "just_right", "text": "Just right", "score": 2},
		{"id": "difficult", "text": "Difficult", "score": 3},
		{"id": "extreme", "text": "Extremely difficult", "score": 4}]},
	{"id": "reward_preference", "text": "Which reward would you prefer?", "answers": [
		{"id": "healing", "text": "Healing items"},
		{"id": "weapons", "text": "Stronger weapons"},
		{"id": "abilities", "text": "Special abilities"},
		{"id": "rare_gear", "text": "Rare equipment"}]},
	{"id": "improvement", "text": "What should be improved?", "answers": [
		{"id": "animations", "text": "Combat animations"},
		{"id": "enemy_variety", "text": "Enemy variety"},
		{"id": "weapon_variety", "text": "Weapon variety"},
		{"id": "level_design", "text": "Level design"},
		{"id": "all_good", "text": "Everything feels good"}]},
]

## Completion bonuses (separate from normal post-wave loot).
const REWARDS := [
	{"id": "heal_50", "title": "Healing Potion", "desc": "Restore 50% of maximum health.", "color": Color(0.9, 0.2, 0.25)},
	{"id": "damage_15", "title": "Damage Boost", "desc": "+15% melee damage for the next wave.", "color": Color(1.0, 0.6, 0.15)},
	{"id": "energy_full", "title": "Energy Crystal", "desc": "Fully restore special-ability energy.", "color": Color(0.5, 0.4, 1.0)},
]

static func question(index: int) -> Dictionary:
	return QUESTIONS[index]

static func find_answer(question_id: String, answer_id: String) -> Dictionary:
	for q in QUESTIONS:
		if q.id == question_id:
			for a in q.answers:
				if a.id == answer_id:
					return a
	return {}
