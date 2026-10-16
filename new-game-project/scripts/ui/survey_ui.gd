class_name SurveyUI
extends CanvasLayer
## "Ancient Relic" survey overlay. Runs while the tree is paused.
## Flow: intro -> one question per page (answer required, Back/Next) -> Submit
## -> completion animation -> pick one reward card -> completed signal.
## Closing before Submit emits abandoned(draft) and grants nothing.
## Keyboard: 1-5 pick an answer, Enter = Next/Submit, Backspace = Back, Esc = close.

signal started
signal abandoned(draft: Dictionary)
signal completed(answers: Dictionary, reward_id: String)

const GOLD := Color(1.0, 0.8, 0.3)

var is_open := false
var _answers: Dictionary = {}
var _page := -1          # -1 intro, 0..n-1 questions, n = completion
var _submitted := false
var _claimed := false
var _began := false
var _wave := 0
var _dim: ColorRect
var _panel: PanelContainer
var _content: VBoxContainer
var _motes: CPUParticles2D

func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_dim = ColorRect.new()
	_dim.color = Color(0.02, 0.01, 0.03, 0.8)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_dim)
	_motes = CPUParticles2D.new()
	_motes.amount = 40
	_motes.lifetime = 5.0
	_motes.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	_motes.emission_rect_extents = Vector2(900, 50)
	_motes.direction = Vector2(0, -1)
	_motes.spread = 20.0
	_motes.gravity = Vector2.ZERO
	_motes.initial_velocity_min = 20.0
	_motes.initial_velocity_max = 50.0
	_motes.scale_amount_min = 2.0
	_motes.scale_amount_max = 4.0
	_motes.color = Color(1.0, 0.8, 0.35, 0.6)
	_dim.add_child(_motes)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim.add_child(center)
	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(760, 520)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.04, 0.09, 0.88)
	sb.border_color = GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	sb.set_content_margin_all(32)
	sb.shadow_color = Color(1.0, 0.75, 0.2, 0.25)
	sb.shadow_size = 24
	_panel.add_theme_stylebox_override("panel", sb)
	center.add_child(_panel)
	_content = VBoxContainer.new()
	_content.add_theme_constant_override("separation", 14)
	_panel.add_child(_content)
	_dim.visible = false

func open(wave: int, draft: Dictionary) -> void:
	if is_open:
		return  # never stack two survey windows
	is_open = true
	_wave = wave
	_answers = draft.duplicate()
	_submitted = false
	_claimed = false
	_began = false
	_dim.visible = true
	_motes.position = Vector2(get_viewport().get_visible_rect().size.x * 0.5, get_viewport().get_visible_rect().size.y + 20)
	_motes.emitting = true
	_show_intro(wave)

func close() -> void:
	if not is_open or _submitted:
		return
	is_open = false
	_dim.visible = false
	abandoned.emit(_answers.duplicate())

# ---------------------------------------------------------------- pages
func _clear() -> void:
	for c in _content.get_children():
		c.queue_free()
	_content.modulate.a = 0.0
	_content.position.y = 12.0
	var t := create_tween().set_parallel(true)
	t.tween_property(_content, "modulate:a", 1.0, 0.25)
	t.tween_property(_content, "position:y", 0.0, 0.25).set_ease(Tween.EASE_OUT)

func _label(text: String, size: int, color := Color(0.92, 0.9, 0.85)) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(l)
	return l

func _style(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(2)
	s.set_corner_radius_all(8)
	s.set_content_margin_all(10)
	return s

func _button(text: String, cb: Callable, selected := false, parent: Control = null) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 48)
	b.add_theme_font_size_override("font_size", 22)
	var normal := _style(Color(0.35, 0.25, 0.08, 0.95) if selected else Color(0.1, 0.08, 0.14, 0.9), GOLD if selected else Color(0.5, 0.42, 0.25))
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", _style(Color(0.25, 0.18, 0.08, 0.95), GOLD))
	b.add_theme_stylebox_override("pressed", _style(Color(0.4, 0.3, 0.1, 0.95), GOLD))
	b.add_theme_stylebox_override("focus", _style(Color(0, 0, 0, 0), GOLD.lightened(0.3)))
	b.add_theme_color_override("font_color", GOLD if selected else Color(0.9, 0.88, 0.82))
	b.pressed.connect(cb)
	(parent if parent else _content).add_child(b)
	return b

func _nav_row() -> HBoxContainer:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	_content.add_child(row)
	return row

func _show_intro(wave: int) -> void:
	_page = -1
	_clear()
	_label("THE ANCIENT RELIC AWAKENS", 40, GOLD)
	_label("The relic of wave %d hums with forgotten power. Answer its %d questions to synchronize with it and claim a bonus reward.\n\nAnswers stay on this device and are anonymous." % [wave, SurveyData.QUESTIONS.size()], 20)
	if not _answers.is_empty():
		_label("Your previous answers have been restored.", 18, GOLD.darkened(0.2))
	var row := _nav_row()
	_button("  Close  ", close, false, row)
	var b := _button("  Begin  ", _begin, true, row)
	b.grab_focus.call_deferred()

func _begin() -> void:
	if not _began:
		_began = true
		started.emit()
	_show_question(0)

func _show_question(i: int) -> void:
	_page = i
	_clear()
	var q := SurveyData.question(i)
	var n := SurveyData.QUESTIONS.size()
	_label("QUESTION %d / %d" % [i + 1, n], 16, GOLD)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0, 8)
	bar.value = float(i) / n * 100.0
	bar.add_theme_stylebox_override("fill", _style(GOLD, GOLD))
	bar.add_theme_stylebox_override("background", _style(Color(0.15, 0.12, 0.1), Color(0.3, 0.25, 0.15)))
	_content.add_child(bar)
	create_tween().tween_property(bar, "value", float(i + 1) / n * 100.0, 0.4)
	_label(q.text, 28)
	var sel: String = _answers.get(q.id, "")
	var k := 1
	for a in q.answers:
		var aid: String = a.id
		_button("%d.  %s" % [k, a.text], _select.bind(q.id, aid), aid == sel)
		k += 1
	var hint := _label("" if sel != "" else "Choose an answer to continue.", 16, Color(0.8, 0.5, 0.4))
	hint.name = "Hint"
	var row := _nav_row()
	_button("  Back  ", _back, false, row)
	_button("  Close  ", close, false, row)
	if i == n - 1:
		_button("  Submit  ", _submit, sel != "", row)
	else:
		_button("  Next  ", _next, sel != "", row)

func _select(qid: String, aid: String) -> void:
	_answers[qid] = aid
	_show_question(_page)  # redraw to update highlight

func _current_answered() -> bool:
	return _answers.get(SurveyData.question(_page).id, "") != ""

func _next() -> void:
	if not _current_answered():
		_flash_hint()
		return
	_show_question(_page + 1)

func _back() -> void:
	if _page > 0:
		_show_question(_page - 1)
	else:
		_show_intro(_wave)

func _flash_hint() -> void:
	var h := _content.get_node_or_null("Hint") as Label
	if h:
		h.text = "Please choose an answer first."
		h.modulate = Color(2, 2, 2)
		create_tween().tween_property(h, "modulate", Color.WHITE, 0.4)

func _submit() -> void:
	if _submitted:
		return  # double-submit guard
	for q in SurveyData.QUESTIONS:
		if _answers.get(q.id, "") == "":
			_flash_hint()
			return
	_submitted = true
	_page = SurveyData.QUESTIONS.size()
	_clear()
	var title := _label("RELIC SYNCHRONIZED!", 52, GOLD)
	title.pivot_offset = Vector2(350, 30)
	title.scale = Vector2(0.3, 0.3)
	var t := create_tween()
	t.tween_property(title, "scale", Vector2(1.15, 1.15), 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.tween_property(title, "scale", Vector2.ONE, 0.15)
	_motes.amount = 80
	_label("You have completed the ancient relic survey.\nChoose one reward:", 22)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	row.modulate.a = 0.0
	_content.add_child(row)
	t.tween_property(row, "modulate:a", 1.0, 0.4)
	for r in SurveyData.REWARDS:
		_reward_card(row, r)

func _reward_card(row: HBoxContainer, r: Dictionary) -> void:
	var b := Button.new()
	b.custom_minimum_size = Vector2(220, 170)
	b.text = "%s\n\n%s" % [r.title, r.desc]
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.add_theme_font_size_override("font_size", 19)
	var c: Color = r.color
	b.add_theme_stylebox_override("normal", _style(Color(c.darkened(0.75), 0.95), c))
	b.add_theme_stylebox_override("hover", _style(Color(c.darkened(0.55), 0.95), GOLD))
	b.add_theme_stylebox_override("pressed", _style(Color(c.darkened(0.4), 0.95), GOLD))
	b.pressed.connect(_claim.bind(r.id))
	row.add_child(b)

func _claim(reward_id: String) -> void:
	if _claimed:
		return  # reward can only be claimed once
	_claimed = true
	is_open = false
	_motes.amount = 40
	var t := create_tween()
	t.tween_property(_dim, "modulate:a", 0.0, 0.3)
	t.tween_callback(func():
		_dim.visible = false
		_dim.modulate.a = 1.0)
	completed.emit(_answers.duplicate(), reward_id)

func _unhandled_input(event: InputEvent) -> void:
	if not is_open:
		return
	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		close()
	elif event is InputEventKey and event.pressed and not event.echo and _page >= 0 and _page < SurveyData.QUESTIONS.size():
		var q := SurveyData.question(_page)
		var idx: int = event.keycode - KEY_1
		if idx >= 0 and idx < q.answers.size():
			_select(q.id, q.answers[idx].id)
		elif event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER:
			if _page == SurveyData.QUESTIONS.size() - 1:
				_submit()
			else:
				_next()
		elif event.keycode == KEY_BACKSPACE:
			_back()
		else:
			return
	else:
		return
	get_viewport().set_input_as_handled()
