class_name SurveyStore
extends RefCounted
## Local, anonymous storage of survey ANSWERS (definitions live in SurveyData).
## Saved as JSON in user://. Missing or corrupted files fall back to defaults.
## No personal data is collected; nothing is uploaded anywhere.

const PATH := "user://survey_responses.json"
const FORMAT := 1

static var data: Dictionary = {}

static func _defaults() -> Dictionary:
	return {
		"format": FORMAT,
		"respondent": "anonymous",
		"drafts": {},        # "wave_N" -> {question_id: answer_id}
		"responses": [],     # completed survey records
		"counters": {"tokens_collected": 0, "started": 0, "completed": 0, "abandoned": 0},
	}

static func load_data() -> void:
	data = _defaults()
	if not FileAccess.file_exists(PATH):
		return
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		push_warning("SurveyStore: cannot open save, using defaults")
		return
	var parsed = JSON.parse_string(f.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY or int(parsed.get("format", -1)) != FORMAT:
		push_warning("SurveyStore: invalid or outdated save, resetting")
		return
	# Validate each section individually so one bad field does not lose everything.
	if typeof(parsed.get("drafts")) == TYPE_DICTIONARY:
		data.drafts = parsed.drafts
	if typeof(parsed.get("responses")) == TYPE_ARRAY:
		for r in parsed.responses:
			if typeof(r) == TYPE_DICTIONARY and r.has("survey_id") and typeof(r.get("answers")) == TYPE_ARRAY:
				data.responses.append(r)
	if typeof(parsed.get("counters")) == TYPE_DICTIONARY:
		for k in data.counters.keys():
			data.counters[k] = maxi(int(parsed.counters.get(k, 0)), 0)

static func save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f == null:
		push_warning("SurveyStore: save failed (%s)" % error_string(FileAccess.get_open_error()))
		return
	f.store_string(JSON.stringify(data, "\t"))

static func _ensure() -> void:
	if data.is_empty():
		load_data()

static func count(key: String) -> void:
	_ensure()
	data.counters[key] = int(data.counters.get(key, 0)) + 1
	save()

static func get_draft(wave: int) -> Dictionary:
	_ensure()
	return (data.drafts.get("wave_%d" % wave, {}) as Dictionary).duplicate()

static func save_draft(wave: int, answers: Dictionary) -> void:
	_ensure()
	data.drafts["wave_%d" % wave] = answers.duplicate()
	save()

## Stores one completed survey record and clears its draft.
static func record_completion(wave: int, answers: Dictionary, reward_id: String) -> void:
	_ensure()
	var list := []
	for q in SurveyData.QUESTIONS:
		list.append({"question_id": q.id, "answer_id": answers.get(q.id, "")})
	data.responses.append({
		"survey_id": SurveyData.SURVEY_ID,
		"survey_version": SurveyData.VERSION,
		"wave": wave,
		"answers": list,
		"completed": true,
		"completed_at": Time.get_datetime_string_from_system(true),
		"reward": reward_id,
	})
	data.drafts.erase("wave_%d" % wave)
	data.counters.completed = int(data.counters.completed) + 1
	save()
