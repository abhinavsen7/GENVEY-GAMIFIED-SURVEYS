extends Node

const BACKEND_URL: String = "http://localhost:8000/api/telemetry"

static func send_implicit_choice(
	player_id: String,
	question_id: String,
	interaction_type: String,
	selected_option: String,
	metric_delta: float = 1.0,
	weapon_equipped: String = "CrystalBlade"
) -> void:
	var payload = {
		"player_id": player_id,
		"question_id": question_id,
		"interaction_type": interaction_type,
		"selected_option": selected_option,
		"metric_delta": metric_delta,
		"weapon_equipped": weapon_equipped
	}
	var json_str = JSON.stringify(payload)
	var headers = ["Content-Type: application/json"]
	
	# Instantiate an HTTPRequest node dynamically
	var tree = Engine.get_main_loop() as SceneTree
	if not tree or not tree.current_scene:
		print("[TelemetryClient] Implicit event: ", json_str)
		return
	
	var http = HTTPRequest.new()
	tree.current_scene.add_child(http)
	http.request_completed.connect(
		func(_result, response_code, _response_headers, _body):
			print("[TelemetryClient] Logged event response: ", response_code)
			http.queue_free()
	)
	var err = http.request(BACKEND_URL, headers, HTTPClient.METHOD_POST, json_str)
	if err != OK:
		print("[TelemetryClient] Failed to dispatch request: ", err)
		http.queue_free()
