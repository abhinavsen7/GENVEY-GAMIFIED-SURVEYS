class_name SFX
extends RefCounted
## Procedural combat sound synthesizer and one-shot player.
## Generates clean 16-bit PCM waveforms in memory on startup with zero external assets.

static var _cached := false
static var _streams: Dictionary = {}

static func _ensure_cache() -> void:
	if _cached:
		return
	_cached = true
	_streams["swing"] = _gen_swing()
	_streams["hit"] = _gen_hit(false)
	_streams["hit_heavy"] = _gen_hit(true)
	_streams["dodge"] = _gen_dodge()
	_streams["shockwave"] = _gen_shockwave()
	_streams["pickup"] = _gen_pickup()
	_streams["hurt"] = _gen_hurt()
	_streams["death"] = _gen_death()
	_streams["flash"] = _gen_flash()

static func play(parent: Node, key: String, volume_db := 0.0, pitch_scale := 1.0) -> AudioStreamPlayer:
	_ensure_cache()
	var stream: AudioStreamWAV = _streams.get(key, null)
	if stream == null or parent == null or not parent.is_inside_tree():
		return null
	var asp := AudioStreamPlayer.new()
	asp.stream = stream
	asp.volume_db = volume_db
	asp.pitch_scale = pitch_scale
	parent.add_child(asp)
	asp.play()
	asp.finished.connect(asp.queue_free)
	return asp

static func play_3d(parent: Node, key: String, pos: Vector3, volume_db := 0.0, pitch_scale := 1.0) -> AudioStreamPlayer3D:
	_ensure_cache()
	var stream: AudioStreamWAV = _streams.get(key, null)
	if stream == null or parent == null or not parent.is_inside_tree():
		return null
	var asp := AudioStreamPlayer3D.new()
	asp.stream = stream
	asp.volume_db = volume_db
	asp.pitch_scale = pitch_scale
	asp.max_distance = 32.0
	parent.add_child(asp)
	asp.global_position = pos
	asp.play()
	asp.finished.connect(asp.queue_free)
	return asp

# --- Quick access helpers ----------------------------------------------------
static func swing(parent: Node, pitch := 1.0) -> void:
	play(parent, "swing", -2.0, pitch * randf_range(0.95, 1.05))

static func hit(parent: Node, pos: Vector3, heavy := false) -> void:
	play_3d(parent, "hit_heavy" if heavy else "hit", pos, 1.0 if heavy else -1.0, randf_range(0.92, 1.08))

static func dodge(parent: Node) -> void:
	play(parent, "dodge", -3.0, randf_range(0.95, 1.05))

static func shockwave(parent: Node, pos: Vector3) -> void:
	play_3d(parent, "shockwave", pos, 3.0, randf_range(0.95, 1.02))

static func pickup(parent: Node) -> void:
	play(parent, "pickup", 1.0, 1.0)

static func hurt(parent: Node) -> void:
	play(parent, "hurt", 2.0, randf_range(0.9, 1.1))

static func death(parent: Node, pos: Vector3) -> void:
	play_3d(parent, "death", pos, 0.0, randf_range(0.9, 1.05))

static func flash(parent: Node) -> void:
	play(parent, "flash", 0.0, randf_range(0.98, 1.05))

# --- Synthesis engines -------------------------------------------------------
static func _create_wav(samples: PackedFloat32Array, rate: int = 22050) -> AudioStreamWAV:
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = rate
	wav.stereo = false
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		var s := clampf(samples[i], -1.0, 1.0)
		var val := int(round(s * 32767.0))
		if val < 0:
			val += 65536
		bytes[i * 2] = val & 0xFF
		bytes[i * 2 + 1] = (val >> 8) & 0xFF
	wav.data = bytes
	return wav

static func _gen_swing() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.14
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	var env := 0.0
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		if p < 0.2:
			env = p / 0.2
		else:
			env = 1.0 - (p - 0.2) / 0.8
		var noise := randf_range(-1.0, 1.0)
		var tone := sin(t * TAU * lerpf(320.0, 110.0, p))
		samples[i] = (noise * 0.55 + tone * 0.45) * env * 0.55
	return _create_wav(samples, rate)

static func _gen_hit(heavy: bool) -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.22 if heavy else 0.14
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var env := exp(-p * (6.5 if heavy else 11.0))
		var noise := randf_range(-1.0, 1.0) * env
		var tone := sin(t * TAU * lerpf(180.0 if heavy else 140.0, 40.0, p)) * env
		samples[i] = (noise * 0.65 + tone * 0.75) * (0.85 if heavy else 0.65)
	return _create_wav(samples, rate)

static func _gen_dodge() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.20
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var env := sin(p * PI)
		var noise := randf_range(-1.0, 1.0)
		var tone := sin(t * TAU * lerpf(240.0, 130.0, p))
		samples[i] = (noise * 0.35 + tone * 0.65) * env * 0.45
	return _create_wav(samples, rate)

static func _gen_shockwave() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.42
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var env := exp(-p * 4.2)
		var freq := lerpf(130.0, 30.0, p)
		var tone := sin(t * TAU * freq)
		var noise := randf_range(-1.0, 1.0) * exp(-p * 14.0)
		samples[i] = (tone * 0.85 + noise * 0.3) * env * 0.9
	return _create_wav(samples, rate)

static func _gen_pickup() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.32
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	var notes: Array[float] = [523.25, 659.25, 783.99]
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var note_idx := int(p * 3.0)
		var freq: float = notes[clampi(note_idx, 0, 2)]
		var note_t := fmod(t, dur / 3.0) / (dur / 3.0)
		var env := exp(-note_t * 5.0)
		var tone := sin(t * TAU * freq) + sin(t * TAU * freq * 2.0) * 0.25
		samples[i] = tone * env * 0.55
	return _create_wav(samples, rate)

static func _gen_hurt() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.16
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var env := exp(-p * 9.0)
		var tone := sin(t * TAU * lerpf(160.0, 50.0, p))
		samples[i] = tone * env * 0.75
	return _create_wav(samples, rate)

static func _gen_death() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.38
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var env := exp(-p * 3.8)
		var noise := randf_range(-1.0, 1.0) * exp(-p * 6.0)
		var tone := sin(t * TAU * lerpf(95.0, 24.0, p))
		samples[i] = (tone * 0.75 + noise * 0.45) * env * 0.75
	return _create_wav(samples, rate)

static func _gen_flash() -> AudioStreamWAV:
	var rate := 22050
	var dur := 0.18
	var n := int(rate * dur)
	var samples := PackedFloat32Array()
	samples.resize(n)
	for i in n:
		var t := float(i) / rate
		var p := t / dur
		var env := exp(-p * 6.0)
		var noise := randf_range(-1.0, 1.0) * env
		var tone := sin(t * TAU * lerpf(600.0, 200.0, p)) * env
		samples[i] = (tone * 0.6 + noise * 0.5) * 0.65
	return _create_wav(samples, rate)
