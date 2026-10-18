# 🎮 NEURO-SYMBOLIC GAME COMPILER & GAMIFIED SURVEY ENGINE (ACT 3)
> **Master Architecture Guide for Developers, Collaborators, and Autonomous AI Coding Agents**  
> *AMD Hackathon Act 3 — Track 4: Create a New Kind of Experience (Entertainment, Gaming & Media)*  
> *Last Updated: October 2026*

---

## 1. System Overview & Core Architecture

The **Neuro-Symbolic AI Game Compiler & Gamified Survey Engine** is a full-stack platform that transforms open-ended corporate survey intent and demographic targets into deeply interactive, mechanically rich **3D and 2D games**.

Instead of boring multiple-choice forms with 2% response rates, the compiler leverages **Gemma 4 (31B-IT via AMD Token Factory)** with **zero local VRAM** to generate living game worlds where business decisions, pricing sensitivity, and feature prioritization are tested through **gameplay choices, combat encounters, mechanical levers, survey forge anvils, and systemic affordances**.

### Key Modalities & Viewports
1. **100% True Fullscreen WebGL Player (`100vw x 100vh`)**: Playable directly in browser via Three.js with AABB Box3 sliding physics, real skeletal animations, target lock-on, parry & riposte, and dynamic HUD.
2. **Native Desktop Godot 4 Window**: Launchable with one click (`POST /api/godot/launch-native`), generating `godot_kernel/scenes/CompiledGame.tscn` using native GDScript (`MasterCombatController.gd`, `EnemyUnit3D.gd`, `InteractiveProp3D.gd`).
3. **Company Studio (`/company`)**: Multi-tab interface featuring Natural-Language Demographic & Survey Intent compilation, Teammate Game Cartridge selection, Asset Pack Manager, and Behavioral Analytics.
4. **Player Game Library (`/player`)**: Card library of compiled games with instant launch, playtime tracking, and progression.

---

## 2. Active Services, Ports & Network Map

| Service | Port | Process / Command | Description |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend** | `:8000` | `.venv/bin/uvicorn backend.main:app --port 8000 --host 0.0.0.0` | Compiler, ChromaDB RAG, Cohort Profiler, Godot runner, Auth & Telemetry APIs |
| **Vite Frontend Dev** | `:5173` | `npm --prefix frontend run dev -- --host 0.0.0.0` | React 18, Tailwind, Three.js, Lucide Icons, Fullscreen Canvas |

> [!IMPORTANT]
> **Port Discipline**: Only keep ports `:8000` (FastAPI) and `:5173` (Vite) running. The machine is an HP 250 G9 (i5-1235U, 32GB RAM); strictly avoid runaway loops, unthrottled downloading, or memory leaks.

---

## 3. Directory Layout & File Manifest

```text
/home/me/Videos/AMDHACKTHREE/
├── AGENT_HANDOFF_DOCS.md                     # THIS FILE: Master Handoff & Architecture Reference
└── gamified-survey-engine/                   # Core Project Workspace Root
    ├── Dockerfile                            # Multi-stage production container (Node 20 build + Python 3.11 runtime)
    ├── docker-compose.yml                    # Container deployment with /api/health healthcheck
    ├── purge_old_games.sh                    # One-command cleanup of old configs & generated files
    ├── sync_packs_and_vfx.sh                 # Scans ~/Downloads, merges CC0 packs & runs indexer
    ├── custom_asset_packs/                   # 917 Indexed CC0 3D & 2D Game Assets
    │   ├── asset_registry.json               # Master asset catalog with bounding boxes & skeletons
    │   ├── characters_3d/                    # Rigged heroes: Knight, Barbarian, Mage, Rogue, Quaternius RPG, PSX
    │   ├── enemies_3d/                       # Skeletons (Warrior, Mage, Rogue, Minion), Dragons, Bats, Slimes, PSX Killers
    │   ├── environments_3d/                  # 505 Modular Castle walls, floors, arches, crypts, chests, barrels, torches
    │   ├── weapons_3d/                       # 52 Handheld swords, axes, bows, staves, daggers, shields, Quaternius weapons
    │   ├── animations_3d/                    # Universal Animation Library 1 & 2 (86 mocap clips)
    │   ├── effects_3d_2d/                    # BattleFXFree shaders, Kenney particle VFX textures
    │   └── sprites_and_tiles_2d/             # 0x72 Dungeon II, Tiny Swords, FLARE, Lords of Pain Isometric
    ├── game_templates/                       # Teammate Game Cartridge Registry
    │   ├── cartridge_manifest.json           # Contract registry for teammate few-shot engines
    │   ├── dark_souls_cathedral_gauntlet/    # Action ARPG Core (Parry/Riposte, Stamina, Estus)
    │   ├── baldurs_gate_tactical_keep/       # Tactical CRPG (4-AP, D20 Skill Checks, 5-Slot Hotbar)
    │   └── ultima_2d_living_town/            # Living Sandbox (16x16 Pixel Sprites, Prop Affordances)
    ├── godot_kernel/                         # Native Godot 4.7 Engine Project
    │   ├── project.godot                     # Godot 4 project file (Forward+ & Mobile renderer)
    │   ├── scenes/
    │   │   ├── CompiledGame.tscn             # Auto-generated 3D scene from compiler
    │   │   └── compiled_config.json          # Active runtime configuration
    │   └── scripts/
    │       ├── CompiledGameRuntime.gd        # Runtime orchestrator (builds world, spawns hero & props)
    │       ├── MasterCombatController.gd     # 3-Genre Combat State Machine & AnimationTree
    │       ├── EnemyUnit3D.gd                # Multi-phase Boss & Minion AI with poise stagger
    │       ├── InteractiveProp3D.gd          # Solid colliders, lever physics, chest opening, barrel explosions
    │       ├── SpellAndSkillHotbar.gd        # 5-Slot spell casting & cooldown manager
    │       └── World2DController.gd          # 2D top-down & isometric sprite controller
    ├── backend/
    │   ├── main.py                           # FastAPI application entry point & router
    │   ├── compiler/
    │   │   ├── amd_client.py                 # AMD Token Factory client (Gemma-4-31B-IT)
    │   │   ├── gemma4_architect.py           # Natural-language compiler & multi-zone world generator
    │   │   ├── trend_rag.py                  # ChromaDB persistent vector database (15 demographic trends)
    │   │   ├── cohort_profiler.py            # Simplified demographic playtime duration profiler
    │   │   └── video_analyzer.py             # OpenCV combat timing extractor
    │   ├── pipelines/
    │   │   ├── sync_all_user_assets.py       # Incremental downloader, Blender converter & indexer
    │   │   ├── index_custom_packs.py         # Fast registry regeneration script
    │   │   └── godot_scene_compiler.py       # CompiledGame.tscn generator & native window launcher
    │   └── storage/
    │       ├── configs/                      # Stored build_<id>.json and latest_game.json configs
    │       ├── trend_vectordb/               # ChromaDB persistence directory
    │       ├── playtime_sessions.json        # User demographic sessions (user_id, genre, duration)
    │       └── cohort_profiles.json          # Demographic user profiles (user_id, age, gender, genres)
    └── frontend/
        ├── package.json                      # React 18, Vite 5, Tailwind CSS
        ├── vite.config.js                    # Dev server config & proxy
        └── src/
            ├── App.jsx                       # Multi-role router (/auth, /company, /player, /play/:id)
            ├── GameCanvas3D.jsx              # Three.js 3D WebGL engine (Solid AABB sliding, props, combat)
            └── GameCanvas2D.jsx              # 2D pixel-art & isometric sprite engine
```

---

## 4. Key Pipelines & Technical Upgrades

### A. Asset Routing & Strict Classification (`backend/pipelines/sync_all_user_assets.py`)
- Directory-based routing takes strict precedence:
  - Assets inside `environments_3d/` or `ModularCastle/` or `Kenney_Castle_Kit/` are ALWAYS categorized as `environments_3d` (preventing wall pieces like `wall-narrow-wood-fence` from being categorized as weapons due to substring match on "arrow").
  - Assets in `enemies_3d/` or `Quaternius_Monsters/` are ALWAYS `enemies_3d` (preventing torches from being categorized as "orc").
  - Semantic fallback uses word-boundary regex (`\b(arrow|bow|sword|axe|orc|bat)\b`).
- **Modular Part Separation**: Clothing parts (`_Arms`, `_Body`, `_Feet`, `_Legs`, `_Acc_`, `Pauldrons`, `Boots`) are flagged with `is_modular_part: True`. The compiler's `_find_entry` strictly prefers **full rigged hero models** (`Knight`, `Barbarian`, `Mage`, `Rogue`, `Warrior`, `Cleric`, `Wizard`, `Ranger`, `Monk`, `Character_17_Police`, `Female_Ranger`, `Male_Ranger`).

### B. Natural-Language Demographic & Survey Intent Compiler (`backend/compiler/gemma4_architect.py`)
Instead of manual question builders, the Company Studio accepts two natural-language prompts:
1. **Target Demographic**: e.g., *"Gen Z college students & competitive souls gamers"*
   - Automatically queries **ChromaDB Trend RAG** (`backend/compiler/trend_rag.py`) containing 15 seeded gaming trends.
   - Evaluates **Cohort Playtime Profiler** (`backend/compiler/cohort_profiler.py`) to select the historically winning genre based on real play session durations.
2. **Survey Intent**: e.g., *"Determine whether users will pay $10 for our sovereign tier vs $2 for adventurer tier"*
   - Deconstructed into dual Survey Forge Anvils ($10 Sovereign vs $2 Adventurer) placed in Room 1.
   - Generates D20 skill check dialogue options with Envoy NPC.
   - Generates 4-Zone dungeon layout:
     - **Zone 1: Courtyard & Forge Hub**: Survey Forge Anvils ($10 vs $2) verifying gold balance, Envoy NPC.
     - **Zone 2: Catacombs & Lever Gate**: Mechanical lever, solid iron portcullis gate, treasure chest (+10 gold), destructible barrels.
     - **Zone 3: Faction Sanctum**: Shrines, secondary treasure chest (+10 gold).
     - **Zone 4: Sovereign Cathedral**: Boss Arena with multi-phase boss encounter.

### C. 100% Solid 3D Collisions & Prop Mechanics (`frontend/src/GameCanvas3D.jsx`)
- **AABB Box3 Independent X/Z Sliding**: Player position checks test `canMoveTo(nextX, currentZ)` and `canMoveTo(currentX, nextZ)` separately against all wall, pillar, and gate colliders in `s.wallColliders`, enabling smooth wall gliding without tunneling or corner clipping.
- **Physical Props**:
  - **Mechanical Lever**: Approaching within 2.8m displays prompt `[E] Pull Lever`. Pressing `[E]` animates the lever arm and smoothly raises the linked iron portcullis gate, deleting its solid collider.
  - **Treasure Chests**: Pressing `[E]` rotates the chest lid open, awards `+10 Gold`, and drops a relic weapon into player inventory.
  - **Survey Forge Anvils**: Interacting checks player gold (`cost_gold: 10` or `cost_gold: 2`). If affordable, equips the tier weapon and logs `SURVEY_FORGE_PURCHASE` telemetry.
  - **Destructible Barrels**: Striking barrels with weapon slashes or spells triggers an AoE explosion that damages nearby enemies and removes the barrel collider.

### D. Teammate Game Cartridge Registry (`game_templates/`)
Enables modular few-shot gameplay cartridges to be selected in the compiler:
1. `dark_souls_cathedral_gauntlet` (Action ARPG Core)
2. `baldurs_gate_tactical_keep` (Tactical CRPG)
3. `ultima_2d_living_town` (Living Pixel Sandbox)

### E. 2D Retro Sprite Engine & AMD Token Factory Health Telemetry
- **2D Retro Sprite Pipeline (`0x72_DungeonTileset_II` & `PixelFrog_Tiny_Swords`)**:
  - Replaced legacy `LordsOfPain_Isometric` with authentic 16×16 retro pixel-art dungeon tiles (`floor_1.png`, `wall_mid.png`).
  - 4-frame animated sprites for Knights (idle, run, hit), Skeletons, Demons, and Wizard NPCs cycling at 150ms intervals.
  - Image smoothing disabled (`ctx.imageSmoothingEnabled = false`) for razor-sharp rendering.
  - Real animated coins (`coin_anim_f0..3`), openable loot chests (`chest_full_open_anim_f0`), and potions (`flask_big_red.png`).
- **AMD Token Factory Real-Time Status**:
  - `GET /api/amd/status` pings `https://developer.amd.com.cn/radeon/api/v1/models` using `AMD_API_KEY`.
  - Measures live round-trip latency (`~890ms - 1100ms`) and confirms active model (`Gemma-4-31B-IT`).
  - Header pill and Company Studio status card display live `🟢 ONLINE` badge and allow manual re-ping.
- **Empty Question Defaults**:
  - Questions state initializes to empty (`[]`) without hardcoded fantasy filler.
  - Gemma 4 decomposes company `survey_intent` directly into economic and feature trade-offs.

---

## 5. REST API Endpoints Quick Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/amd/status` | Live healthcheck verifying AMD Token Factory connectivity, Gemma 4 model & latency |
| `GET` | `/api/health` | Service healthcheck verifying zero local VRAM status |
| `POST` | `/api/compile` / `/api/compile-campaign` | Compiles survey campaign to 3D/2D game and builds Godot scene |
| `GET` | `/api/games` | Returns list of all compiled games from `backend/storage/configs/` |
| `GET` | `/api/games/{build_id}` | Retrieves specific game configuration |
| `POST` | `/api/godot/launch-native` | Launches compiled game in desktop Godot 4 window |
| `GET` | `/api/cartridges` | Returns registered teammate game cartridges |
| `GET` | `/api/trends` | Returns ChromaDB demographic trends |
| `POST` | `/api/trends/add` | Ingests a new trend document into ChromaDB |
| `GET` | `/api/cohort/playtime` | Returns playtime duration profiler stats |
| `POST` | `/api/cohort/session` | Records player session duration for demographic cohort analysis |
| `POST` | `/api/assets/scan` | Runs incremental scanner on `~/Downloads` |
| `GET` | `/api/custom-assets` | Returns `asset_registry.json` summary and items |
| `POST` | `/api/auth/register` | User / company account registration |
| `POST` | `/api/auth/login` | User authentication |
| `POST` | `/api/telemetry` | Logs in-game behavioral event (parry, forge purchase, chest opened) |
| `GET` | `/api/analytics` | Returns aggregated telemetry events for Company Studio |

---

## 6. How to Run, Test & Maintain

### Starting the Servers
```bash
# In gamified-survey-engine directory:

# 1. Start FastAPI Backend (Port 8000)
.venv/bin/uvicorn backend.main:app --port 8000 --host 0.0.0.0

# 2. Start Vite Dev Server (Port 5173)
npm --prefix frontend run dev -- --host 0.0.0.0
```

### Production Build & Container Deployment
```bash
# Frontend build
npm --prefix frontend run build

# Docker Compose build & start
docker compose up --build -d

# Verify health
curl http://localhost:8000/api/health
```

### Purging Old Games & Clean Start
```bash
# Deletes old build configs, generated placeholders, and resets telemetry
bash purge_old_games.sh
```

### Ingesting New Assets from ~/Downloads
```bash
# Scans ~/Downloads, converts FBX/OBJ via Headless Blender, and rebuilds asset_registry.json
python3 backend/pipelines/sync_all_user_assets.py
```
