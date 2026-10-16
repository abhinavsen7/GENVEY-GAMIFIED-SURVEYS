class_name HUD
extends CanvasLayer
## Action-game HUD plus all menu overlays (title, pause, victory, game over).
## Built in code; it only displays state and emits button signals - the
## Game node owns the actual game flow. Runs while the tree is paused.

signal start_pressed
signal restart_pressed
signal sensitivity_changed(value: float)

const HELP := "WASD  Move\nMouse  Camera\nShift  Sprint\nF  Jump\nSpace  Dodge roll (i-frames)\nLMB  Light combo (x3)\nRMB  Heavy attack\nQ  Shockwave\nTab  Lock-on\nE  Collect item\nG  Start next wave (after rewards)\nEsc  Pause"

var playing := false
var _hp: ProgressBar
var _hp_label: Label
var _sp: ProgressBar
var _sp_label: Label
var _objective: Label
var _kills: Label
var _combo: Label
var _banner: Label
var _title: Control
var _pause: Control
var _end: Control
var _end_title: Label
var _end_text: Label
var _sens: HSlider
var _buffs: Label
var _prompt: PanelContainer
var _prompt_label: Label
var _toast: Label
var _toast_tween: Tween
var _debug: Label
## Set by Game while the survey is open so Esc does not open the pause menu.
var block_pause := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	# --- player bars (top-left)
	var box := VBoxContainer.new()
	box.position = Vector2(28, 24)
	box.add_theme_constant_override("separation", 6)
	root.add_child(box)
	_hp_label = _label("HP 150 / 150", 18)
	box.add_child(_hp_label)
	_hp = _bar(Color(0.8, 0.1, 0.12), Vector2(360, 22))
	box.add_child(_hp)
	_sp_label = _label("[Q] Shockwave  READY", 16)
	box.add_child(_sp_label)
	_sp = _bar(Color(0.55, 0.3, 1.0), Vector2(260, 12))
	_sp.value = 100
	box.add_child(_sp)
	# --- objective (top-center)
	_objective = _label("", 22)
	_objective.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_objective.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_objective.position = Vector2(-300, 24)
	_objective.size = Vector2(600, 40)
	root.add_child(_objective)
	# --- kills + combo (top-right)
	_kills = _label("Defeated: 0", 20)
	_kills.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_kills.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_kills.position = Vector2(-330, 24)
	_kills.size = Vector2(300, 30)
	root.add_child(_kills)
	_combo = _label("", 54)
	_combo.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
	_combo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_combo.position = Vector2(-430, -120)
	_combo.size = Vector2(400, 80)
	_combo.add_theme_color_override("font_color", Color(1.0, 0.75, 0.3))
	root.add_child(_combo)
	# --- center banner
	_banner = _label("", 64)
	_banner.set_anchors_preset(Control.PRESET_CENTER)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.position = Vector2(-500, -160)
	_banner.size = Vector2(1000, 90)
	_banner.modulate.a = 0.0
	root.add_child(_banner)
	var hint := _label("Esc: Pause / Controls", 14)
	hint.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hint.position = Vector2(28, -40)
	hint.modulate.a = 0.6
	root.add_child(hint)
	# --- weapon / buff line under the bars
	_buffs = _label("Weapon: Temple Sword", 15)
	_buffs.modulate = Color(1.0, 0.8, 0.5)
	box.add_child(_buffs)
	# --- interaction prompt (bottom-center)
	_prompt = PanelContainer.new()
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.05, 0.03, 0.08, 0.8)
	ps.border_color = Color(1.0, 0.8, 0.3)
	ps.set_border_width_all(2)
	ps.set_corner_radius_all(8)
	ps.set_content_margin_all(12)
	_prompt.add_theme_stylebox_override("panel", ps)
	_prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_prompt.position = Vector2(-220, -190)
	_prompt.custom_minimum_size = Vector2(440, 0)
	_prompt_label = _label("", 20)
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.add_child(_prompt_label)
	_prompt.visible = false
	root.add_child(_prompt)
	# --- toast notifications
	_toast = _label("", 26)
	_toast.set_anchors_preset(Control.PRESET_CENTER)
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.position = Vector2(-450, 60)
	_toast.size = Vector2(900, 40)
	_toast.modulate.a = 0.0
	root.add_child(_toast)
	# --- developer-only survey analytics panel (F3, debug builds only)
	_debug = _label("", 15)
	_debug.position = Vector2(28, 220)
	_debug.modulate = Color(0.7, 1.0, 0.7)
	_debug.visible = false
	root.add_child(_debug)
	_build_overlays(root)

## Shows the nearest collectible's name, description and key prompt.
func show_prompt(item_name: String, desc: String) -> void:
	_prompt_label.text = "%s\n%s\n[E] Collect" % [item_name, desc]
	_prompt.visible = true

func hide_prompt() -> void:
	_prompt.visible = false

func toast(t: String, c := Color(1, 0.95, 0.8)) -> void:
	_toast.text = t
	_toast.add_theme_color_override("font_color", c)
	if _toast_tween:
		_toast_tween.kill()
	_toast.modulate.a = 1.0
	_toast_tween = create_tween()
	_toast_tween.tween_interval(1.8)
	_toast_tween.tween_property(_toast, "modulate:a", 0.0, 0.5)

func set_buffs(weapon: String, mult: float, temp: float) -> void:
	var t := "Weapon: %s  (x%.2f dmg)" % [weapon, mult]
	if temp > 1.0:
		t += "   Relic Boost +%d%% (this wave)" % int(round((temp - 1.0) * 100.0))
	_buffs.text = t

func toggle_debug(text: String) -> void:
	if not OS.is_debug_build():
		return
	_debug.visible = not _debug.visible
	_debug.text = text

func _label(t: String, size: int) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 6)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _bar(c: Color, sz: Vector2) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = sz
	b.show_percentage = false
	b.value = 100
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.6)
	bg.border_color = Color(0.6, 0.5, 0.4, 0.8)
	bg.set_border_width_all(2)
	var fg := StyleBoxFlat.new()
	fg.bg_color = c
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fg)
	return b

func _panel(parent: Control, title: String, sub: String) -> Array:
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.0, 0.04, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	parent.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.add_child(center)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 14)
	center.add_child(v)
	var t := _label(title, 72)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_color_override("font_color", Color(0.85, 0.2, 0.25))
	v.add_child(t)
	var s := _label(sub, 22)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(s)
	dim.visible = false
	return [dim, v, t, s]

func _button(v: VBoxContainer, text: String, cb: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(260, 48)
	b.add_theme_font_size_override("font_size", 22)
	b.pressed.connect(cb)
	var c := CenterContainer.new()
	c.add_child(b)
	v.add_child(c)

func _help(v: VBoxContainer) -> void:
	var h := _label(HELP, 17)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	h.modulate = Color(0.85, 0.85, 0.95)
	v.add_child(h)

func _build_overlays(root: Control) -> void:
	var p := _panel(root, "SHADOW REQUIEM", "Purge the corrupted temple. Survive three waves, then escape through the portal.")
	_title = p[0]
	_button(p[1], "Start", func(): start_pressed.emit())
	_help(p[1])
	p = _panel(root, "PAUSED", "")
	_pause = p[0]
	_button(p[1], "Resume", resume)
	_button(p[1], "Restart", func(): restart_pressed.emit())
	var sl := _label("Camera sensitivity", 18)
	sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p[1].add_child(sl)
	_sens = HSlider.new()
	_sens.min_value = 0.0005
	_sens.max_value = 0.006
	_sens.step = 0.0001
	_sens.value = 0.0025
	_sens.custom_minimum_size = Vector2(300, 24)
	_sens.value_changed.connect(func(val: float): sensitivity_changed.emit(val))
	var sc := CenterContainer.new()
	sc.add_child(_sens)
	p[1].add_child(sc)
	_help(p[1])
	p = _panel(root, "", "")
	_end = p[0]
	_end_title = p[2]
	_end_text = p[3]
	_button(p[1], "Restart", func(): restart_pressed.emit())

# ---------------------------------------------------------------- API
func show_title() -> void:
	_title.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func begin_play() -> void:
	_title.visible = false
	_end.visible = false
	_pause.visible = false
	playing = true
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func show_end(victory: bool, text: String) -> void:
	playing = false
	_end_title.text = "VICTORY" if victory else "YOU DIED"
	_end_title.add_theme_color_override("font_color", Color(1.0, 0.8, 0.35) if victory else Color(0.8, 0.1, 0.12))
	_end_text.text = text
	_end.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func set_health(cur: float, mx: float) -> void:
	_hp.value = cur / mx * 100.0
	_hp_label.text = "HP %d / %d" % [ceili(cur), int(mx)]

func set_special(remaining: float, total: float) -> void:
	_sp.value = (1.0 - remaining / total) * 100.0
	_sp_label.text = "[Q] Shockwave  READY" if remaining <= 0.0 else "[Q] Shockwave  %.1fs" % remaining

func set_combo(count: int) -> void:
	if count < 2:
		_combo.text = ""
		return
	_combo.text = "%d HITS" % count
	_combo.pivot_offset = _combo.size * Vector2(1, 0.5)
	_combo.scale = Vector2(1.25, 1.25)
	create_tween().tween_property(_combo, "scale", Vector2.ONE, 0.12)

func set_kills(n: int) -> void:
	_kills.text = "Defeated: %d" % n

func set_objective(t: String) -> void:
	_objective.text = t

func banner(t: String) -> void:
	_banner.text = t
	var tw := create_tween()
	tw.tween_property(_banner, "modulate:a", 1.0, 0.25)
	tw.tween_interval(1.4)
	tw.tween_property(_banner, "modulate:a", 0.0, 0.5)

func resume() -> void:
	_pause.visible = false
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if not playing and event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if playing and not block_pause and event.is_action_pressed("pause"):
		if get_tree().paused:
			resume()
		else:
			get_tree().paused = true
			_pause.visible = true
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		get_viewport().set_input_as_handled()
