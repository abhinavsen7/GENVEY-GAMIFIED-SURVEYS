# Shadow Requiem - 3D hack-and-slash prototype

Open the project in Summer Engine and press Play (main scene: res://main.tscn).

## Controls
WASD move | Mouse camera | Shift sprint | F jump | Space dodge roll (i-frames)
LMB light combo (4 hits) | RMB heavy attack | Q shockwave | Tab lock-on | Esc pause
1 Crimson Flash | 2 Phantom Tempest | 3 Heavenfall Cleaver | V ultimate (needs a full meter)
E collect loot | G start the next wave | F3 dev stats panel

## Hero character
- `res://characters/gothic_swordsman_35784c99/` - the playable hero: `rig.glb` (dark-fantasy Gothic Swordsman with 24-bone skeleton).
- Ships complete native animations: `Idle`, `Walk`, `Run`, `Roll Dodge`, `Attack`, and `Double Combo Attack`.
- Hit reaction and death animations are retargeted at load time from `res://characters/mercenary_ef761979/` which shares the same 24-bone hierarchy.
- All locomotion animations (`Idle`, `Walk`, `Run`) are set to `Animation.LOOP_LINEAR` for continuous, seamless locomotion without animation freezes.
- The dodge roll is speed-scaled to 0.50s for responsive combat evasion with i-frames.
- Two-handed weapon grip is solved analytically via two-bone inverse kinematics (IK) on the right and left arms.

## Structure
- scripts/game.gd - game state: title, 3 waves (final wave has the elite), portal, victory/game over, restart
- scripts/components/health.gd - reusable Health component (signals: changed, damaged, died)
- scripts/player/player.gd - movement, sprint, jump, dodge, camera rig (CameraYaw/CameraPitch/SpringArm3D/Camera3D), lock-on, hit reaction, death
- scripts/player/player_combat.gd - combo/heavy/special, buffered input, shape-query hit detection, once-per-swing hits
- scripts/enemies/enemy.gd - Grunt / Knight / Assassin / Elite presets; Idle, Patrol, Chase, Attack, Recover, Stagger, Dead; NavigationAgent3D
- scripts/world/arena.gd - temple arena geometry, torches, sigil, exit portal, runtime navmesh bake
- scripts/fx/fx.gd - hit sparks, damage numbers, shockwave, death burst, dodge afterimages, hit-stop
- scripts/ui/hud.gd - HUD + title/pause/victory/game-over overlays

Collision layers: 1 world, 2 player, 3 (value 4) enemies.

## Loot, rewards and relic survey
- After waves 1 and 2: Health Potion, Energy Crystal, weapon drop (Shadow Blade / Requiem Edge, +20% dmg) and an Ancient Relic (survey token). E collects, G starts the next wave.
- scripts/loot/pickup.gd - collectible visuals + once-only try_collect()
- scripts/survey/survey_data.gd - question/answer/reward definitions (add questions here)
- scripts/survey/survey_store.gd - anonymous local answers in user://survey_responses.json (drafts, completed records, counters; corrupt data falls back safely)
- scripts/survey/survey_analytics.gd - local stats; F3 shows the dev panel (debug builds only)
- scripts/ui/survey_ui.gd - relic survey overlay (1-5 pick answer, Enter next, Backspace back, Esc close)

## Audio & Sound FX
- Procedural real-time 16-bit PCM sound synthesizer (`scripts/audio/sfx.gd`):
  - Weapon swings, hit impact crunches, heavy hits, dodge rolls, shockwave bass drops, item pickups, hurt groans, and enemy death dissolves. Zero external sound files needed.

## Camera
- Full mouse orbit: horizontal yaw + smooth vertical pitch look with clamp.
- Automatic vertical target framing during lock-on.
- Instant camera alignment on spawn (no drift).
