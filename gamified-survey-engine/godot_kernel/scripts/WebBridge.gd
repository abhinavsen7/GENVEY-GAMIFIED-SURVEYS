extends Node

signal campaign_received(config: Dictionary)

var _js_callback_ref = null

func _ready() -> void:
	if OS.has_feature("web"):
		_js_callback_ref = JavaScriptBridge.create_callback(_on_js_campaign_loaded)
		var window = JavaScriptBridge.get_interface("window")
		window.godotLoadCampaign = _js_callback_ref
		JavaScriptBridge.eval("console.log('[Godot 4 Wasm Bridge] Connected to Antigravity React Frontend');")

func _on_js_campaign_loaded(args: Array) -> void:
	if args.size() == 0:
		return
	var json_str: String = str(args[0])
	var parsed = JSON.parse_string(json_str)
	if typeof(parsed) == TYPE_DICTIONARY:
		emit_signal("campaign_received", parsed)
		var loader = get_tree().root.find_child("GameLoader", true, false)
		if loader and loader.has_method("rebuild_world_from_config"):
			loader.rebuild_world_from_config(parsed)

func emit_telemetry_to_react(event_dict: Dictionary) -> void:
	if OS.has_feature("web"):
		var json_payload = JSON.stringify(event_dict)
		var window = JavaScriptBridge.get_interface("window")
		if window.onGodotTelemetry:
			window.onGodotTelemetry(json_payload)
