class_name SurveyAnalytics
extends RefCounted
## Read-only local analytics computed from SurveyStore. No gameplay logic here.

static func _answers_for(question_id: String) -> Array:
	var out := []
	for r in SurveyStore.data.get("responses", []):
		for a in r.get("answers", []):
			if a.get("question_id") == question_id and a.get("answer_id", "") != "":
				out.append(a.answer_id)
	return out

static func _most_common(values: Array, question_id: String) -> String:
	if values.is_empty():
		return "n/a"
	var counts := {}
	for v in values:
		counts[v] = int(counts.get(v, 0)) + 1
	var best := ""
	var best_n := -1
	for k in counts:
		if counts[k] > best_n:
			best_n = counts[k]
			best = k
	var a := SurveyData.find_answer(question_id, best)
	return "%s (%d)" % [a.get("text", best), best_n]

static func _average(question_id: String) -> float:
	var total := 0.0
	var n := 0
	for id in _answers_for(question_id):
		var a := SurveyData.find_answer(question_id, id)
		if a.has("score"):
			total += float(a.score)
			n += 1
	return total / n if n > 0 else 0.0

static func completion_rate() -> float:
	var c: Dictionary = SurveyStore.data.get("counters", {})
	var started := int(c.get("started", 0))
	return float(c.get("completed", 0)) / started * 100.0 if started > 0 else 0.0

static func summary() -> Dictionary:
	SurveyStore._ensure()
	var c: Dictionary = SurveyStore.data.counters
	var reward_counts := {}
	for r in SurveyStore.data.responses:
		var id: String = r.get("reward", "")
		if id != "":
			reward_counts[id] = int(reward_counts.get(id, 0)) + 1
	var top_reward := "n/a"
	var top_n := 0
	for k in reward_counts:
		if reward_counts[k] > top_n:
			top_n = reward_counts[k]
			top_reward = "%s (%d)" % [k, top_n]
	return {
		"tokens_collected": c.get("tokens_collected", 0),
		"started": c.get("started", 0),
		"completed": c.get("completed", 0),
		"abandoned": c.get("abandoned", 0),
		"completion_rate": completion_rate(),
		"top_weapon": _most_common(_answers_for("weapon_preference"), "weapon_preference"),
		"top_reward_pref": _most_common(_answers_for("reward_preference"), "reward_preference"),
		"top_reward_claimed": top_reward,
		"avg_difficulty": _average("difficulty"),
		"avg_enjoyment": _average("combat_enjoyment"),
	}

static func report_text() -> String:
	var s := summary()
	return ("SURVEY ANALYTICS (local, dev only)\nTokens collected: %d\nStarted: %d   Completed: %d   Abandoned: %d\n" +
		"Completion rate: %.1f%%\nTop weapon: %s\nTop reward preference: %s\nTop reward claimed: %s\n" +
		"Avg difficulty (1-4): %.2f\nAvg enjoyment (1-4): %.2f") % [
		s.tokens_collected, s.started, s.completed, s.abandoned, s.completion_rate,
		s.top_weapon, s.top_reward_pref, s.top_reward_claimed, s.avg_difficulty, s.avg_enjoyment]
