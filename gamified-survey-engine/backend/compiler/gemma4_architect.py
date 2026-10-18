import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.compiler.amd_client import amd_client
from backend.compiler.trend_rag import trend_rag
from backend.compiler.cohort_profiler import analyze_demographic_playtime_winner
from backend.pipelines.godot_scene_compiler import compile_godot_scene_from_config


class SurveyQuestion(BaseModel):
    id: str
    question_text: str
    target_metric: str  # e.g., "risk_tolerance", "collaborative_empathy", "price_sensitivity"
    options: List[str]


class SurveyCampaignInput(BaseModel):
    company_name: str
    campaign_title: Optional[str] = None
    dimension: Optional[str] = "3D"  # "3D" or "2D"
    style_mode: Optional[str] = None  # "BALDURS_GATE_CRPG" | "DARK_SOULS_ACTION" | "ULTIMA_IMMERSIVE_SANDBOX" | "CUSTOM_FREEFORM" | any custom genre
    genre_mode: Optional[str] = "BALDURS_GATE_CRPG"
    custom_genre: Optional[str] = None  # Freeform user-defined genre (e.g. "PSX Survival Horror", "Bullet-Heaven Horde Survivor", "Castle Siege Warfare", "Mystery Noir Detective")
    target_demographic: Optional[str] = None  # Natural language target demographic e.g. "Gen Z college students"
    survey_intent: Optional[str] = None  # Natural language survey intent e.g. "Find out if users will pay $10 for premium tier vs $2 per month"
    cartridge_id: Optional[str] = None  # Teammate game cartridge ID e.g. "dark_souls_cathedral_gauntlet"
    length_minutes: int = 8
    theme_prompt: str = ""
    questions: Optional[List[SurveyQuestion]] = None


REGISTRY_PATH = Path(__file__).resolve().parent.parent.parent / "custom_asset_packs" / "asset_registry.json"


def _resolve_genre_profile(campaign: SurveyCampaignInput) -> Dict[str, Any]:
    """
    Resolves either one of the 3 classic RPG styles OR synthesizes a bespoke custom genre profile
    whenever the user requests a genre outside the predetermined presets.
    """
    raw_style = (campaign.style_mode or campaign.genre_mode or "").strip()
    custom_req = (campaign.custom_genre or "").strip()
    combined_low = f"{raw_style} {custom_req} {campaign.theme_prompt}".lower()

    # Check if user explicitly requested a non-predetermined genre or if prompt describes one
    predetermined = {"BALDURS_GATE_CRPG", "DARK_SOULS_ACTION", "ULTIMA_IMMERSIVE_SANDBOX", "CRPG_ISOMETRIC", "SOULSLIKE_ACTION", "IMMERSIVE_SIM"}
    non_preset_keywords = [
        "survival horror", "resident evil", "silent hill", "zombie", "outbreak", "stalker",
        "bullet heaven", "vampire survivors", "horde", "arena shooter", "twin stick", "roguelike",
        "castle siege", "tower defense", "medieval warfare", "kingdom defense",
        "detective", "mystery", "noir", "investigation", "cozy", "walking sim",
        "cyberpunk", "sci-fi", "extraction", "heist", "stealth", "martial arts", "brawler"
    ]
    is_custom = (
        bool(custom_req)
        or raw_style.upper() == "CUSTOM_FREEFORM"
        or (raw_style != "" and raw_style.upper() not in predetermined)
        or any(k in combined_low for k in non_preset_keywords)
    )

    if not is_custom:
        up = raw_style.upper()
        if "SOUL" in up or "ACTION" in up or "DARK" in up:
            std = "DARK_SOULS_ACTION"
            pref_hero = "Knight"
            pref_weapons = ["sword_2handed", "axe_2handed", "Claymore"]
        elif "ULTIMA" in up or "SANDBOX" in up or "IMMERSIVE" in up or "SIM" in up:
            std = "ULTIMA_IMMERSIVE_SANDBOX"
            pref_hero = "Rogue"
            pref_weapons = ["dagger", "sword_1handed", "axe_1handed"]
        else:
            std = "BALDURS_GATE_CRPG"
            pref_hero = "Mage"
            pref_weapons = ["staff", "sword_1handed", "wand"]
        return {
            "is_custom_genre": False,
            "style_mode": std,
            "custom_genre_label": std.replace("_", " ").title(),
            "camera_mode": "THIRD_PERSON_SHOULDER" if std == "DARK_SOULS_ACTION" else "ISOMETRIC_TACTICAL",
            "movement_speed_mult": 1.0,
            "flashlight_mode": False,
            "projectile_mode": (std == "BALDURS_GATE_CRPG"),
            "preferred_hero": pref_hero,
            "preferred_enemies": ["Skeleton_Warrior", "Skeleton_Mage", "Skeleton_Rogue"],
            "preferred_weapons": pref_weapons,
            "encounter_verb": "Speak / Inspect",
            "custom_hotbar": [],
        }

    # Synthesize custom non-predetermined genre profile
    if any(k in combined_low for k in ["horror", "zombie", "psx", "resident", "silent", "hospital", "killer", "outbreak"]):
        label = custom_req or "PSX Survival Horror"
        return {
            "is_custom_genre": True,
            "style_mode": "CUSTOM_FREEFORM",
            "custom_genre_id": "PSX_SURVIVAL_HORROR",
            "custom_genre_label": label,
            "camera_mode": "FIXED_SURVIVAL_HORROR" if "fixed" in combined_low else "THIRD_PERSON_SHOULDER",
            "movement_speed_mult": 0.92,
            "flashlight_mode": True,
            "projectile_mode": True,
            "preferred_hero": "Character_17_Police",
            "preferred_enemies": ["character-zombie", "Character_Killer", "Character_Monster", "character-ghost"],
            "preferred_weapons": ["crossbow_1handed", "dagger", "axe_1handed"],
            "encounter_verb": "Inspect Survivor Radio / Terminal",
            "custom_hotbar": [
                {"id": "sidearm_shot", "name": "Sidearm Double-Tap", "ap_cost": 1, "damage": 46, "color": "#f43f5e", "icon": "🔫"},
                {"id": "flare_burst", "name": "Incendiary Flare", "ap_cost": 1, "damage": 58, "color": "#f97316", "icon": "🧨"},
                {"id": "flashlight_toggle", "name": "Tactical Flashlight", "ap_cost": 0, "color": "#fef08a", "icon": "🔦"},
                {"id": "med_spray", "name": "First-Aid Spray", "ap_cost": 1, "heal": 55, "color": "#22c55e", "icon": "🩹"},
                {"id": "adrenaline_sprint", "name": "Panic Adrenaline", "ap_cost": 0, "move_bonus_m": 8.0, "color": "#38bdf8", "icon": "⚡"},
            ],
        }
    elif any(k in combined_low for k in ["horde", "vampire", "bullet", "arena", "swarm", "roguelike", "twin stick"]):
        label = custom_req or "Bullet-Heaven Horde Survivor"
        return {
            "is_custom_genre": True,
            "style_mode": "CUSTOM_FREEFORM",
            "custom_genre_id": "HORDE_SURVIVOR_ARENA",
            "custom_genre_label": label,
            "camera_mode": "TOP_DOWN_ARENA",
            "movement_speed_mult": 1.38,
            "flashlight_mode": False,
            "projectile_mode": True,
            "preferred_hero": "Wizard",
            "preferred_enemies": ["Bat", "Slime", "character-vampire", "character-ghost", "Dragon"],
            "preferred_weapons": ["Wizard_Staff", "Scythe", "Bow_Evil"],
            "encounter_verb": "Claim Ascension Altar",
            "custom_hotbar": [
                {"id": "arcane_barrage", "name": "Arcane Bolt Volley", "ap_cost": 1, "damage": 52, "color": "#a855f7", "icon": "🔮"},
                {"id": "hellfire_ring", "name": "Hellfire Nova Ring", "ap_cost": 1, "damage": 68, "color": "#ef4444", "icon": "🔥"},
                {"id": "frost_orbit", "name": "Glacial Orbitals", "ap_cost": 1, "damage": 48, "color": "#38bdf8", "icon": "❄️"},
                {"id": "blood_siphon", "name": "Crimson Siphon", "ap_cost": 1, "heal": 50, "color": "#f43f5e", "icon": "🩸"},
                {"id": "phase_dash", "name": "Phantom Blink", "ap_cost": 0, "move_bonus_m": 10.0, "color": "#22d3ee", "icon": "💨"},
            ],
        }
    elif any(k in combined_low for k in ["siege", "castle", "warfare", "defense", "kingdom", "tactical"]):
        label = custom_req or "Medieval Castle Siege Warfare"
        return {
            "is_custom_genre": True,
            "style_mode": "CUSTOM_FREEFORM",
            "custom_genre_id": "CASTLE_SIEGE_WARFARE",
            "custom_genre_label": label,
            "camera_mode": "ISOMETRIC_TACTICAL",
            "movement_speed_mult": 1.12,
            "flashlight_mode": False,
            "projectile_mode": True,
            "preferred_hero": "Warrior",
            "preferred_enemies": ["Dragon", "Skeleton_Warrior", "character-skeleton", "Character_15_Mask"],
            "preferred_weapons": ["Claymore", "Hammer_Double", "Shield_Celtic_Golden"],
            "encounter_verb": "Consult Siege Commander",
            "custom_hotbar": [
                {"id": "claymore_sweep", "name": "Vanguard Cleave", "ap_cost": 1, "damage": 55, "color": "#f59e0b", "icon": "⚔️"},
                {"id": "ballista_volley", "name": "Ballista Fire Volley", "ap_cost": 1, "damage": 72, "color": "#ef4444", "icon": "🏹"},
                {"id": "sabotage_gate", "name": "Breach Portcullis", "ap_cost": 1, "color": "#a855f7", "icon": "💣"},
                {"id": "warhorn_rally", "name": "Warhorn Rally (+HP)", "ap_cost": 1, "heal": 50, "color": "#22c55e", "icon": "📯"},
                {"id": "shield_march", "name": "Phalanx Charge", "ap_cost": 0, "move_bonus_m": 8.0, "color": "#38bdf8", "icon": "🛡️"},
            ],
        }
    elif any(k in combined_low for k in ["detective", "mystery", "noir", "investigation", "cozy", "clue"]):
        label = custom_req or "Mystery Detective Investigation"
        return {
            "is_custom_genre": True,
            "style_mode": "CUSTOM_FREEFORM",
            "custom_genre_id": "MYSTERY_INVESTIGATION",
            "custom_genre_label": label,
            "camera_mode": "THIRD_PERSON_SHOULDER",
            "movement_speed_mult": 1.15,
            "flashlight_mode": True,
            "projectile_mode": False,
            "preferred_hero": "Character_01",
            "preferred_enemies": ["Character_Killer_01", "character-ghost", "Skeleton_Rogue"],
            "preferred_weapons": ["dagger", "staff", "Rogue_Dagger"],
            "encounter_verb": "Interrogate Witness / Inspect Clue",
            "custom_hotbar": [
                {"id": "deduce_strike", "name": "Disarming Strike", "ap_cost": 1, "damage": 42, "color": "#38bdf8", "icon": "🔍"},
                {"id": "flashbulb_stun", "name": "Flashbulb Stun", "ap_cost": 1, "damage": 45, "color": "#fde047", "icon": "📸"},
                {"id": "lockpick_clue", "name": "Unlock Evidence Safe", "ap_cost": 0, "color": "#a855f7", "icon": "🗝️"},
                {"id": "espresso_tonic", "name": "Investigator's Tonic", "ap_cost": 1, "heal": 50, "color": "#22c55e", "icon": "☕"},
                {"id": "lantern_beam", "name": "Toggle UV Lantern", "ap_cost": 0, "color": "#60a5fa", "icon": "🏮"},
            ],
        }
    else:
        label = custom_req or (raw_style if raw_style and raw_style.upper() != "CUSTOM_FREEFORM" else "Custom Hybrid Adventure")
        cam = "TOP_DOWN_ARENA" if "top" in combined_low else ("ISOMETRIC_TACTICAL" if "iso" in combined_low else "THIRD_PERSON_SHOULDER")
        return {
            "is_custom_genre": True,
            "style_mode": "CUSTOM_FREEFORM",
            "custom_genre_id": re.sub(r"[^A-Z0-9]+", "_", label.upper()).strip("_") or "CUSTOM_HYBRID",
            "custom_genre_label": label,
            "camera_mode": cam,
            "movement_speed_mult": 1.2,
            "flashlight_mode": any(k in combined_low for k in ["dark", "night", "flashlight", "cave", "crypt"]),
            "projectile_mode": True,
            "preferred_hero": "Monk" if "monk" in combined_low or "martial" in combined_low else ("Cleric" if "cleric" in combined_low else "Rogue"),
            "preferred_enemies": ["Dragon", "Bat", "Slime", "character-vampire", "Skeleton_Warrior"],
            "preferred_weapons": ["Scythe", "Claymore", "Warrior_Sword", "Cleric_Staff"],
            "encounter_verb": f"Interact ({label})",
            "custom_hotbar": [
                {"id": "custom_q1", "name": f"{label[:14]} Strike", "ap_cost": 1, "damage": 48, "color": "#f97316", "icon": "⚡"},
                {"id": "custom_q2", "name": "Nova Burst", "ap_cost": 1, "damage": 62, "color": "#ec4899", "icon": "💥"},
                {"id": "custom_q3", "name": "World Mechanism", "ap_cost": 0, "color": "#a855f7", "icon": "⚙️"},
                {"id": "custom_q4", "name": "Restore Vitality", "ap_cost": 1, "heal": 55, "color": "#22c55e", "icon": "✨"},
                {"id": "custom_q5", "name": "Overdrive Dash", "ap_cost": 0, "move_bonus_m": 8.0, "color": "#38bdf8", "icon": "🚀"},
            ],
        }


def load_custom_asset_registry() -> Dict[str, Any]:
    if REGISTRY_PATH.exists():
        try:
            return json.loads(REGISTRY_PATH.read_text())
        except Exception as e:
            print(f"[AssetRegistry] Failed to read {REGISTRY_PATH}: {e}")
    return {
        "characters_3d": [],
        "enemies_3d": [],
        "weapons_3d": [],
        "environments_3d": [],
        "animations_3d": [],
        "effects_3d_2d": [],
        "sprites_and_tiles_2d": [],
    }


def _find_entry(entries: List[Dict[str, Any]], query_id: str, fallback_idx: int = 0) -> Dict[str, Any]:
    if not entries:
        return {}
    if query_id:
        q_clean = query_id.replace(".glb", "").replace(".gltf", "").replace(".gdshader", "").strip().lower()
        # 1. Exact match, prioritizing full non-modular models
        for e in entries:
            if e.get("id", "").lower() == q_clean and not e.get("is_modular_part", False):
                return e
        for e in entries:
            if e.get("id", "").lower() == q_clean:
                return e
        # 2. Word match, prioritizing non-modular models
        for e in entries:
            e_words = set(re.findall(r"[a-zA-Z0-9]+", e.get("id", "").lower()))
            if q_clean in e_words and not e.get("is_modular_part", False):
                return e
        # 3. Substring match, prioritizing non-modular models
        for e in entries:
            if q_clean in e.get("id", "").lower() and not e.get("is_modular_part", False):
                return e
        # 4. Any substring match
        for e in entries:
            if q_clean in e.get("id", "").lower():
                return e
    # Prefer non-modular entry for fallback
    non_mod = [e for e in entries if not e.get("is_modular_part", False)]
    if non_mod:
        return non_mod[fallback_idx % len(non_mod)]
    return entries[fallback_idx % len(entries)]


def _build_system_prompt(registry: Dict[str, Any], dimension: str, style_mode: str) -> str:
    chars = registry.get("characters_3d") or registry.get("characters", [])
    enemies = registry.get("enemies_3d") or registry.get("enemies", [])
    weapons = [
        w["id"] for w in (registry.get("weapons_3d") or registry.get("weapons", []))
        if any(k in w["id"].lower() for k in ["sword", "axe", "blade", "staff", "dagger", "spear", "bow"])
    ][:12]
    envs = [env["id"] for env in (registry.get("environments_3d") or registry.get("environment", []))[:18]]
    effects = [fx["id"] for fx in (registry.get("effects_3d_2d") or registry.get("effects", []))[:10]]
    sprites_2d = [s["id"] for s in registry.get("sprites_and_tiles_2d", [])[:12]]

    return f"""You are a Neuro-Symbolic Game Architect on AMD Instinct MI300X (Gemma 4).
Output compact JSON immediately (keep internal thinking under 35 words). Build a custom {dimension} RPG campaign in style `{style_mode}` EXCLUSIVELY using `custom_asset_packs/asset_registry.json`:
- `characters_3d`: {json.dumps([c["id"] for c in chars[:16]])}
- `enemies_3d`: {json.dumps([e["id"] for e in enemies[:14]])}
- `weapons_3d`: {json.dumps(weapons)}
- `environments_3d`: {json.dumps(envs)}
- `effects_3d_2d`: {json.dumps(effects)}
- `sprites_and_tiles_2d`: {json.dumps(sprites_2d)}

Output ONLY valid JSON matching this schema:
{{
  "thinking_trace": "1 short sentence explaining how the prompt and custom_asset_packs shaped the campaign.",
  "campaign_title": "string",
  "dimension": "{dimension}",
  "style_mode": "{style_mode}",
  "player_class": "Male_Ranger | Female_Ranger | Knight | Barbarian | Mage | Rogue | Character_01 | Character_17_Police",
  "weapons": [
    {{
      "weapon_id": "string",
      "name": "string",
      "asset_id": "sword_2handed | axe_2handed | sword_1handed | staff | dagger | Skeleton_Blade | Spear_Blade",
      "vfx_id": "slash | swing | claw | attack_particles | shield_aura | shards",
      "element_type": "FIRE | NECROTIC | LIGHTNING | HOLY",
      "shader_color_hex": "#RRGGBB",
      "base_damage": 75,
      "poise_damage": 90
    }}
  ],
  "rooms": [
    {{
      "room_id": "room_1",
      "name": "string",
      "lighting": {{ "fog_hex": "#0d0f18", "torch_color_hex": "#ff7b29", "ambient_intensity": 0.62 }},
      "wall_style": "Wall_Mid_x2",
      "floor_style": "Floor_2x2",
      "arch_style": "Arch_Segment_Full",
      "props": [
        {{ "asset": "Crate_Long", "x": -4.0, "z": -3.0, "rot_y": 0.0, "interactive_tag": "loot_shrine" }},
        {{ "asset": "Barrel", "x": 4.0, "z": -2.0, "rot_y": 0.0, "interactive_tag": "flammable_barrel" }}
      ],
      "enemies": [
        {{ "archetype": "Skeleton_Warrior | Character_Monster | Character_Killer", "name": "string", "hp": 145, "poise": 85, "speed": 3.2, "vfx_id": "slash", "x": 2.5, "z": 2.0 }}
      ],
      "npc": {{ "name": "string", "model": "Female_Ranger", "x": -3.5, "z": 1.5, "question_id": "string" }}
    }}
  ]
}}"""

import random

# Dynamic 2D Sprite Pools for Anti-Repetition (<50% overlap guarantee)
HERO_SPRITE_POOLS = [
    {
        "id": "knight_m",
        "name": "Knight Champion",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_m_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_m_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_m_hit_anim_f0.png"
    },
    {
        "id": "elf_f",
        "name": "Elven Ranger",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/elf_f_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/elf_f_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/elf_f_hit_anim_f0.png"
    },
    {
        "id": "wizzard_m",
        "name": "Arcane Mage",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_m_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_m_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_m_hit_anim_f0.png"
    },
    {
        "id": "lizard_m",
        "name": "Saurian Duelist",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/lizard_m_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/lizard_m_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/lizard_m_hit_anim_f0.png"
    },
    {
        "id": "dwarf_m",
        "name": "Dwarven Berserker",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/dwarf_m_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/dwarf_m_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/dwarf_m_hit_anim_f0.png"
    },
    {
        "id": "knight_f",
        "name": "Paladin Shieldmaiden",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_f_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_f_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/knight_f_hit_anim_f0.png"
    },
    {
        "id": "wizzard_f",
        "name": "Sorceress",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_f_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_f_run_anim_f{i}.png" for i in range(4)],
        "hit": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_f_hit_anim_f0.png"
    },
]

ENEMY_SPRITE_POOLS = [
    {
        "id": "skelet",
        "name": "Cursed Skeleton",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/skelet_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/skelet_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "goblin",
        "name": "Dungeon Goblin",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/goblin_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/goblin_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "masked_orc",
        "name": "Masked Orc Raider",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/masked_orc_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/masked_orc_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "chort",
        "name": "Shadow Chort",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/chort_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/chort_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "wogol",
        "name": "Wogol Beast",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wogol_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wogol_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "orc_warrior",
        "name": "Orcish Vanguard",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/orc_warrior_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/orc_warrior_run_anim_f{i}.png" for i in range(4)],
    },
]

BOSS_SPRITE_POOLS = [
    {
        "id": "big_demon",
        "name": "Abyssal Archdemon",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/big_demon_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/big_demon_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "ogre",
        "name": "Ogre Warlord",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/ogre_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/ogre_run_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "big_zombie",
        "name": "Grave Goliath",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/big_zombie_idle_anim_f{i}.png" for i in range(4)],
        "run": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/big_zombie_run_anim_f{i}.png" for i in range(4)],
    },
]

NPC_SPRITE_POOLS = [
    {
        "id": "doc",
        "name": "Doctor Alchemist",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/doc_idle_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "angel",
        "name": "Celestial Herald",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/angel_idle_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "pumpkin_dude",
        "name": "Harvest Mystic",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/pumpkin_dude_idle_anim_f{i}.png" for i in range(4)],
    },
    {
        "id": "wizzard_f",
        "name": "Guild Emissary",
        "idle": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wizzard_f_idle_anim_f{i}.png" for i in range(4)],
    },
]

FLOOR_SPRITE_POOLS = [f"floor_{i}" for i in range(1, 9)]

WALL_SPRITE_POOLS = [
    "wall_mid",
    "wall_banner_red",
    "wall_banner_blue",
    "wall_banner_green",
    "wall_banner_yellow",
    "wall_hole_1",
    "wall_hole_2",
    "wall_goo",
]

WEAPON_SPRITE_POOLS = [
    {"id": "weapon_knight_sword", "name": "Knight's Steel Sword", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_knight_sword.png"},
    {"id": "weapon_katana", "name": "Shadow Katana", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_katana.png"},
    {"id": "weapon_cleaver", "name": "Heavy Cleaver", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_cleaver.png"},
    {"id": "weapon_duel_sword", "name": "Duelist Rapier", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_duel_sword.png"},
    {"id": "weapon_golden_sword", "name": "Golden Relic Blade", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_golden_sword.png"},
    {"id": "weapon_green_magic_staff", "name": "Verdant Scepter", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_green_magic_staff.png"},
    {"id": "weapon_waraxe", "name": "Dwarven Waraxe", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_waraxe.png"},
    {"id": "weapon_spear", "name": "Hoplite Spear", "url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_spear.png"},
]


def select_rotated_2d_assets(is_ultima: bool = False) -> Dict[str, Any]:
    """
    Selects 2D game assets guaranteeing <= 50% overlap from the previous game session.
    Maintains persistent usage history in backend/storage/asset_usage_history.json.
    """
    history_file = Path(__file__).resolve().parent.parent / "storage" / "asset_usage_history.json"
    history = {}
    if history_file.exists():
        try:
            with open(history_file, "r") as f:
                history = json.load(f)
        except Exception:
            history = {}

    prev_hero = history.get("last_hero")
    prev_enemy = history.get("last_enemy")
    prev_boss = history.get("last_boss")
    prev_npc = history.get("last_npc")
    prev_floor = history.get("last_floor")
    prev_wall = history.get("last_wall")
    prev_weapon = history.get("last_weapon")

    # Filter out previous assets to guarantee fresh variety (0% overlap, well below 50% max)
    avail_heroes = [h for h in HERO_SPRITE_POOLS if h["id"] != prev_hero] or HERO_SPRITE_POOLS
    avail_enemies = [e for e in ENEMY_SPRITE_POOLS if e["id"] != prev_enemy] or ENEMY_SPRITE_POOLS
    avail_bosses = [b for b in BOSS_SPRITE_POOLS if b["id"] != prev_boss] or BOSS_SPRITE_POOLS
    avail_npcs = [n for n in NPC_SPRITE_POOLS if n["id"] != prev_npc] or NPC_SPRITE_POOLS
    avail_floors = [f for f in FLOOR_SPRITE_POOLS if f != prev_floor] or FLOOR_SPRITE_POOLS
    avail_walls = [w for w in WALL_SPRITE_POOLS if w != prev_wall] or WALL_SPRITE_POOLS
    avail_weapons = [w for w in WEAPON_SPRITE_POOLS if w["id"] != prev_weapon] or WEAPON_SPRITE_POOLS

    selected_hero = random.choice(avail_heroes)
    selected_enemy = random.choice(avail_enemies)
    selected_boss = random.choice(avail_bosses)
    selected_npc = random.choice(avail_npcs)
    selected_floor = random.choice(avail_floors)
    selected_wall = random.choice(avail_walls)
    selected_weapon = random.choice(avail_weapons)

    # Save selections to history
    try:
        history_file.parent.mkdir(parents=True, exist_ok=True)
        with open(history_file, "w") as f:
            json.dump({
                "last_hero": selected_hero["id"],
                "last_enemy": selected_enemy["id"],
                "last_boss": selected_boss["id"],
                "last_npc": selected_npc["id"],
                "last_floor": selected_floor,
                "last_wall": selected_wall,
                "last_weapon": selected_weapon["id"],
                "is_ultima": is_ultima,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }, f, indent=2)
    except Exception as e:
        print(f"[select_rotated_2d_assets] History save note: {e}")

    ground_url = "/custom_assets/sprites_and_tiles_2d/ultima7_britannia/terrain_atlas.png" if is_ultima else f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/{selected_floor}.png"
    wall_url = f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/{selected_wall}.png"

    return {
        "pack_name": "Ultima7_Britannia" if is_ultima else "0x72_DungeonTileset_II_Rotated",
        "is_ultima_britannia": is_ultima,
        "tileset_ground_url": ground_url,
        "tileset_wall_url": wall_url,
        "tileset_wall_left_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wall_left.png",
        "tileset_wall_right_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/wall_right.png",
        "gold_prop_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/coin_anim_f0.png",
        "chest_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/chest_full_open_anim_f0.png",
        "chest_empty_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/chest_empty_open_anim_f0.png",
        "potion_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/flask_big_red.png",
        "door_closed_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/doors_leaf_closed.png",
        "door_open_url": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/doors_leaf_open.png",
        "hero_selected": selected_hero,
        "enemy_selected": selected_enemy,
        "boss_selected": selected_boss,
        "npc_selected": selected_npc,
        "weapon_selected": selected_weapon,
        # Backwards compatibility bindings
        "hero_knight": selected_hero,
        "hero_wizard": selected_hero,
        "enemy_skeleton": selected_enemy,
        "enemy_boss_demon": selected_boss,
        "npc_envoy": selected_npc,
        "coin_frames": [f"/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/coin_anim_f{i}.png" for i in range(4)],
        "weapons_2d": {
            "sword": selected_weapon["url"],
            "selected": selected_weapon["url"],
            "axe": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_waraxe.png",
            "staff": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_red_magic_staff.png",
            "hammer": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_big_hammer.png",
            "bow": "/custom_assets/sprites_and_tiles_2d/0x72_DungeonTileset_II/weapon_bow.png"
        },
        "ultima_britannia": {
            "terrain_atlas_url": "/custom_assets/sprites_and_tiles_2d/ultima7_britannia/terrain_atlas.png",
            "shapes_atlas_url": "/custom_assets/sprites_and_tiles_2d/ultima7_britannia/shapes_atlas.png",
            "cuboid_atlas_url": "/custom_assets/sprites_and_tiles_2d/ultima7_britannia/cuboid_atlas.png",
            "faces_atlas_url": "/custom_assets/sprites_and_tiles_2d/ultima7_britannia/faces_atlas.png",
            "shapes_meta_url": "/custom_assets/sprites_and_tiles_2d/ultima7_britannia/u7shapes.json"
        } if is_ultima else None
    }


async def deconstruct_intent_with_gemma(
    company_name: str,
    survey_intent: Optional[str] = None,
    target_demographic: Optional[str] = None,
    theme_prompt: Optional[str] = None,
    target_count: int = 4
) -> List[SurveyQuestion]:
    """
    Deconstructs company intent into realistic, targeted survey questions using Gemma 4.
    Strictly forbids generic placeholder text, fantasy filler, or boilerplate templates.
    """
    intent_desc = (survey_intent or "").strip()
    demo_desc = (target_demographic or "General Consumers / Active Users").strip()
    theme_desc = (theme_prompt or "").strip()

    sys_prompt = (
        "You are an expert market research architect and survey designer for gamified enterprise telemetry. "
        "Your task is to decompose the company's business intent into realistic, highly targeted survey questions with 4 distinct, concrete options.\n"
        "STRICT CONSTRAINTS:\n"
        "1. Output valid JSON strictly formatted as: {\"questions\": [{\"id\": \"q1\", \"question_text\": \"...\", \"target_metric\": \"...\", \"options\": [\"opt1\", \"opt2\", \"opt3\", \"opt4\"]}]}\n"
        "2. ZERO PLACEHOLDER TEXT, ZERO generic templates, and ZERO fantasy filler (e.g., do NOT use 'uncharted crisis', 'sovereign tier', 'elder runes', or static boilerplate).\n"
        "3. Every question and choice must directly reflect the actual company, intent, trade-offs, and pricing/features mentioned.\n"
        f"4. Generate exactly {target_count} questions."
    )

    user_prompt = (
        f"Company Name: {company_name}\n"
        f"Survey Intent: {intent_desc if intent_desc else f'Understand key user preferences and willingness to pay for {company_name} products and features.'}\n"
        f"Target Demographic: {demo_desc}\n"
        f"Context / Theme: {theme_desc}\n"
        "Generate concrete, professional questions and options directly evaluating this intent."
    )

    try:
        import asyncio
        llm_data = await asyncio.wait_for(amd_client.chat_json(sys_prompt, user_prompt), timeout=7.0)
        q_list = llm_data.get("questions", []) if isinstance(llm_data, dict) else []
        result: List[SurveyQuestion] = []
        for idx, q_item in enumerate(q_list):
            q_text = str(q_item.get("question_text", "")).strip()
            opts = [str(o).strip() for o in q_item.get("options", []) if str(o).strip()]
            if q_text and len(opts) >= 2:
                while len(opts) < 4:
                    opts.append(f"Neutral / Other ({company_name})")
                metric = str(q_item.get("target_metric") or f"intent_metric_{idx + 1}").strip()
                result.append(SurveyQuestion(
                    id=str(q_item.get("id") or f"q_intent_{idx + 1}"),
                    question_text=q_text,
                    target_metric=metric,
                    options=opts[:4]
                ))
        if result:
            return result
    except Exception as e:
        print(f"[deconstruct_intent_with_gemma] LLM intent decomposition note: {e}")

    # High-fidelity neuro-symbolic intent fallback (Extract real tokens from survey_intent, NEVER use generic crisis filler)
    clean_intent = intent_desc or f"product priorities and service quality for {company_name}"
    prices = re.findall(r"\$[\d\.]+", clean_intent)
    p1 = prices[0] if prices else "$10/mo"
    p2 = prices[1] if len(prices) > 1 else "$3/mo"

    fallback_questions = [
        SurveyQuestion(
            id="q_intent_core_choice",
            question_text=f"Regarding {company_name}'s focus ({clean_intent[:95]}): What is your primary preference?",
            target_metric="core_intent_preference",
            options=[
                f"Full Access / Premium Experience ({p1})" if prices else f"Fast automated experience with {company_name}",
                f"Essential / Budget Plan ({p2})" if prices else f"Granular control and deep customization",
                f"Free entry with core features ($0)" if prices else f"Real-time responsive performance",
                f"Custom enterprise / flexible setup" if prices else f"Highest security and privacy guarantee"
            ]
        ),
        SurveyQuestion(
            id="q_intent_priority_driver",
            question_text=f"When choosing {company_name}, which factor holds the greatest weight in your decision?",
            target_metric="intent_priority_driver",
            options=[
                f"Cost efficiency and price-to-performance ratio",
                f"Reliability, quality, and proven community trust",
                f"Rapid onboarding and intuitive simplicity",
                f"Comprehensive feature depth and flexibility"
            ]
        ),
        SurveyQuestion(
            id="q_intent_feature_value",
            question_text=f"How would improvements to {company_name}'s offerings most impact your daily use?",
            target_metric="value_realization",
            options=[
                f"Significantly increases daily adoption and engagement",
                f"Moderate improvement for specific workflows",
                f"Only beneficial if bundled with no price increase",
                f"Minimal impact compared to current alternative solutions"
            ]
        ),
        SurveyQuestion(
            id="q_intent_satisfaction_threshold",
            question_text=f"What would be the decisive reason for you to recommend {company_name} to peers?",
            target_metric="nps_advocacy_trigger",
            options=[
                f"Exceptional performance exceeding competing services",
                f"Honest, transparent pricing and clear roadmap",
                f"Active developer/community support and responsiveness",
                f"Uncompromising reliability and zero downtime"
            ]
        )
    ]
    return fallback_questions[:target_count]


def _target_room_count(length_minutes: int) -> int:
    if length_minutes <= 6:
        return 4
    elif length_minutes <= 12:
        return 6
    else:
        return 8


async def compile_survey_to_game(campaign: SurveyCampaignInput) -> Dict[str, Any]:
    build_id = str(uuid.uuid4())
    compiled_at = datetime.now(timezone.utc).isoformat()
    dimension = "2D" if str(campaign.dimension or "3D").upper().startswith("2D") else "3D"

    # 1. Demographic Cohort Profiler & ChromaDB Trend RAG
    cohort_analysis = None
    trend_analysis = None
    if campaign.target_demographic and campaign.target_demographic.strip():
        demo_str = campaign.target_demographic.strip()
        trend_analysis = trend_rag.query_top_trend(demo_str)
        cohort_analysis = await analyze_demographic_playtime_winner(demo_str)
        # Adapt style to winning genre if not explicitly customized
        if (not campaign.style_mode or campaign.style_mode == "BALDURS_GATE_CRPG") and not campaign.custom_genre:
            winning_g = cohort_analysis.get("winning_genre")
            if winning_g in ["DARK_SOULS_ACTION", "BALDURS_GATE_CRPG", "ULTIMA_IMMERSIVE_SANDBOX", "HORDE_SURVIVOR_ARENA", "PSX_SURVIVAL_HORROR"]:
                campaign.style_mode = winning_g

    genre_profile = _resolve_genre_profile(campaign)
    style_mode = genre_profile["style_mode"]
    custom_genre_label = genre_profile.get("custom_genre_label", style_mode)
    target_rooms = _target_room_count(campaign.length_minutes)

    # 2. Survey Intent Deconstruction & Questions via Gemma 4 (Zero Placeholders)
    survey_questions: List[SurveyQuestion] = []
    if campaign.questions:
        survey_questions = [
            q for q in campaign.questions
            if q.question_text and q.question_text.strip()
        ]

    if not survey_questions:
        survey_questions = await deconstruct_intent_with_gemma(
            company_name=campaign.company_name,
            survey_intent=campaign.survey_intent,
            target_demographic=campaign.target_demographic,
            theme_prompt=campaign.theme_prompt,
            target_count=max(2, target_rooms)
        )

    genre_profile = _resolve_genre_profile(campaign)
    style_mode = genre_profile["style_mode"]
    custom_genre_label = genre_profile.get("custom_genre_label", style_mode)
    target_rooms = _target_room_count(campaign.length_minutes)
    registry = load_custom_asset_registry()

    chars = registry.get("characters_3d") or registry.get("characters", [])
    enemies_reg = registry.get("enemies_3d") or registry.get("enemies", [])
    weapons_reg = [
        w for w in (registry.get("weapons_3d") or registry.get("weapons", []))
        if any(k in w["id"].lower() for k in ["sword", "axe", "blade", "staff", "dagger", "crossbow", "spear", "claymore", "scythe", "hammer", "bow", "shield"])
    ] or (registry.get("weapons_3d") or registry.get("weapons", []))
    env_reg = registry.get("environments_3d") or registry.get("environment", [])
    anims_reg = registry.get("animations_3d") or registry.get("animations", [])
    effects_reg = registry.get("effects_3d_2d") or registry.get("effects", [])
    sprites_2d_reg = registry.get("sprites_and_tiles_2d", [])

    system_prompt = _build_system_prompt(registry, dimension, f"{style_mode} ({custom_genre_label})")
    user_prompt = (
        f"Do NOT think at length; output compact JSON with 2 rooms in `rooms[]` immediately.\n"
        f"- Company Name: {campaign.company_name}\n"
        f"- Requested Title: {campaign.campaign_title or ''}\n"
        f"- Dimension: {dimension}\n"
        f"- Gameplay Style: {style_mode}\n"
        f"- Custom Genre Specification: {custom_genre_label}\n"
        f"- Playtime: {campaign.length_minutes}m ({target_rooms} total rooms)\n"
        f"- Theme: {campaign.theme_prompt}\n"
        f"- Survey Questions: {json.dumps([{'id': q.id, 'metric': q.target_metric, 'text': q.question_text, 'options': q.options} for q in survey_questions])}\n"
    )

    try:
        import asyncio
        raw_config = await asyncio.wait_for(amd_client.chat_json(system_prompt, user_prompt), timeout=6.0)
        if not isinstance(raw_config, dict):
            raw_config = {}
    except Exception as e:
        print(f"[Gemma4Architect] Fast neuro-symbolic synthesis after LLM note: {e}")
        raw_config = {}

    if campaign.campaign_title and campaign.campaign_title.strip():
        raw_config["campaign_title"] = campaign.campaign_title.strip()
    elif not raw_config.get("campaign_title"):
        style_titles = {
            "BALDURS_GATE_CRPG": f"Chronicles of {campaign.company_name}: Dice of Fate",
            "DARK_SOULS_ACTION": f"Ashen Covenant of {campaign.company_name}",
            "ULTIMA_IMMERSIVE_SANDBOX": f"Britannia Ledger: {campaign.company_name} Sandbox",
            "CUSTOM_FREEFORM": f"{campaign.company_name}: {custom_genre_label}",
        }
        raw_config["campaign_title"] = style_titles.get(style_mode, f"{campaign.company_name}: {custom_genre_label}")

    raw_config["build_id"] = build_id
    raw_config["compiled_at"] = compiled_at
    raw_config["company_name"] = campaign.company_name
    raw_config["dimension"] = dimension
    raw_config["style_mode"] = style_mode
    raw_config["custom_genre"] = custom_genre_label
    raw_config["is_custom_genre"] = bool(genre_profile.get("is_custom_genre", False))
    raw_config["custom_mechanics"] = genre_profile
    raw_config["target_demographic"] = campaign.target_demographic or ""
    raw_config["survey_intent"] = campaign.survey_intent or ""
    raw_config["cartridge_id"] = campaign.cartridge_id or ""
    raw_config["cohort_analysis"] = cohort_analysis
    raw_config["trend_analysis"] = trend_analysis
    raw_config["starting_gold"] = 0
    # Keep legacy genre_mode populated for compatibility
    raw_config["genre_mode"] = (
        "CRPG_ISOMETRIC" if style_mode == "BALDURS_GATE_CRPG" else
        "SOULSLIKE_ACTION" if style_mode == "DARK_SOULS_ACTION" else
        "CUSTOM_GENRE" if style_mode == "CUSTOM_FREEFORM" else
        "IMMERSIVE_SIM"
    )
    raw_config["length_minutes"] = campaign.length_minutes
    raw_config["theme_prompt"] = campaign.theme_prompt
    raw_config["amd_model"] = amd_client.text_model
    raw_config["asset_source"] = "custom_asset_packs/asset_registry.json"

    # Choose Player 3D Model based on genre_profile + theme
    default_hero = genre_profile.get("preferred_hero", "Male_Ranger")
    requested_player = str(raw_config.get("player_class") or default_hero)
    if genre_profile.get("is_custom_genre"):
        requested_player = default_hero
    player_entry = _find_entry(chars, requested_player, fallback_idx=0)
    is_65_bone_rig = (player_entry.get("bones_count", 0) == 65)

    anim_pack_urls = [a["url"] for a in anims_reg if not a["id"].endswith("_RM")]
    if not anim_pack_urls and anims_reg:
        anim_pack_urls = [anims_reg[0]["url"]]

    player_config = {
        "id": player_entry.get("id", "Male_Ranger"),
        "pack": player_entry.get("pack", "Modular Character Outfits - Fantasy[Standard]"),
        "model_url": player_entry.get("url", "/custom_assets/characters_3d/fantasy_outfits/Male_Ranger.gltf"),
        "bones_count": player_entry.get("bones_count", 65),
        "right_hand_bone": player_entry.get("right_hand_bone") or ("hand_r" if is_65_bone_rig else "handslot.r"),
        "left_hand_bone": player_entry.get("left_hand_bone") or ("hand_l" if is_65_bone_rig else "handslot.l"),
        "dimensions": player_entry.get("dimensions", [1.9, 2.0, 2.8]),
        "ground_offset_y": player_entry.get("ground_offset_y", 0.0),
        "target_height_m": 1.85,
        "idle_anim": "Sword_Idle" if is_65_bone_rig else "Idle",
        "walk_anim": "Walk_Loop" if is_65_bone_rig else "Walking_A",
        "run_anim": "Jog_Fwd_Loop" if is_65_bone_rig else "Running_A",
        "sprint_anim": "Sprint_Loop" if is_65_bone_rig else "Running_B",
        "dodge_anim": "Roll" if is_65_bone_rig else "Dodge_Forward",
        "block_anim": "Sword_Block" if is_65_bone_rig else "Block",
        "hit_anim": "Hit_Chest" if is_65_bone_rig else "Hit_A",
        "death_anim": "Death01" if is_65_bone_rig else "Death_A",
        "attack_anims": (
            ["Sword_Regular_A", "Sword_Regular_B", "Sword_Regular_C", "Sword_Heavy_Combo", "Sword_Attack"]
            if is_65_bone_rig else
            ["1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Slice_Horizontal", "1H_Melee_Attack_Chop", "2H_Melee_Attack_Spin"]
        ),
        "animation_pack_urls": anim_pack_urls
    }
    raw_config["player_class"] = player_config["id"]
    # 2D Sprite & Tileset Bindings with anti-repetition rotation & Ultima 7 Britannia binding
    is_ultima = (
        style_mode == "ULTIMA_IMMERSIVE_SANDBOX"
        or (campaign.cartridge_id and "ultima" in campaign.cartridge_id.lower())
        or "ultima" in str(custom_genre_label).lower()
    )
    raw_config["sprites_2d_config"] = select_rotated_2d_assets(is_ultima=is_ultima)
    raw_config["sprites_2d_config"]["indexed_count"] = len(sprites_2d_reg)

    default_abilities = genre_profile.get("custom_hotbar") or [
        {"id": "cleave", "name": "Main Hand Cleave", "ap_cost": 1, "range_m": 2.8, "aoe_radius_m": 1.8, "damage": 38, "color": "#f97316", "vfx": "slash", "icon": "⚔️"},
        {"id": "fireball", "name": "Fireball AoE", "ap_cost": 2, "range_m": 10.0, "aoe_radius_m": 3.5, "damage": 64, "color": "#ef4444", "vfx": "attack_particles", "icon": "🔥"},
        {"id": "frost_nova", "name": "Frost Nova", "ap_cost": 2, "range_m": 6.5, "aoe_radius_m": 3.2, "damage": 48, "color": "#38bdf8", "vfx": "shards", "icon": "❄️"},
        {"id": "healing_word", "name": "Healing Word", "ap_cost": 1, "range_m": 8.0, "aoe_radius_m": 2.0, "heal": 45, "color": "#22c55e", "vfx": "shield_aura", "icon": "✨"},
        {"id": "tactical_dash", "name": "Tactical Dash", "ap_cost": 1, "range_m": 7.0, "aoe_radius_m": 1.0, "move_bonus_m": 6.0, "color": "#a855f7", "vfx": "swing", "icon": "💨"},
    ]

    # Deep Mechanics Configuration per Style / Custom Genre
    raw_config["mechanics_spec"] = {
        "style_mode": style_mode,
        "custom_genre_label": custom_genre_label,
        "dimension": dimension,
        "crpg_abilities": default_abilities,
        "dark_souls_combat": {
            "max_stamina": 100,
            "max_poise": 100,
            "estus_max_charges": 3,
            "parry_window_ms": 200,
            "hitstop_ms": 70,
            "riposte_multiplier": 2.4,
        },
        "ultima_affordances": [
            {"key": "E", "action": "USE_INTERACT", "label": "Use / Talk / Open"},
            {"key": "G", "action": "GRAB_MOVE", "label": "Grab & Reposition Prop"},
            {"key": "1", "action": "IGNITE_BARREL", "label": "Ignite Oil / Alchemical Barrel"},
            {"key": "2", "action": "PICK_LOCK", "label": "Pick Lock / Bypass Portcullis"},
            {"key": "3", "action": "TOGGLE_TORCH", "label": "Light / Extinguish Torch"},
        ]
    }

    if not raw_config.get("thinking_trace"):
        raw_config["thinking_trace"] = (
            f"Compiled {dimension} {custom_genre_label} ({style_mode}) '{raw_config.get('campaign_title')}' on {amd_client.text_model} "
            f"using 917 indexed custom_asset_packs ({player_config['id']}, Quaternius, Kenney, KayKit, PSX, Lords of Pain 2D, 0x72, Tiny Swords)."
        )

    # Normalize weapons[] using preferred_weapons from genre_profile
    pref_weps = genre_profile.get("preferred_weapons", ["sword_2handed", "axe_2handed", "staff"])
    raw_weapons = raw_config.get("weapons", [])
    if not isinstance(raw_weapons, list) or len(raw_weapons) < 3 or genre_profile.get("is_custom_genre"):
        raw_weapons = [
            {
                "weapon_id": f"vanguard_{pref_weps[0]}_{build_id[:4]}",
                "name": f"{campaign.company_name} {pref_weps[0].replace('_', ' ').title()}",
                "asset_id": pref_weps[0],
                "vfx_id": "slash",
                "element_type": "FIRE",
                "shader_color_hex": "#f97316",
                "base_damage": 76,
                "poise_damage": 95
            },
            {
                "weapon_id": f"astral_{pref_weps[1 % len(pref_weps)]}_{build_id[:4]}",
                "name": f"Stormcleaver {pref_weps[1 % len(pref_weps)].replace('_', ' ').title()}",
                "asset_id": pref_weps[1 % len(pref_weps)],
                "vfx_id": "swing",
                "element_type": "LIGHTNING",
                "shader_color_hex": "#38bdf8",
                "base_damage": 84,
                "poise_damage": 115
            },
            {
                "weapon_id": f"abyssal_{pref_weps[2 % len(pref_weps)]}_{build_id[:4]}",
                "name": f"Sovereign {pref_weps[2 % len(pref_weps)].replace('_', ' ').title()}",
                "asset_id": pref_weps[2 % len(pref_weps)],
                "vfx_id": "shards",
                "element_type": "NECROTIC",
                "shader_color_hex": "#a855f7",
                "base_damage": 68,
                "poise_damage": 75
            }
        ]

    normalized_weapons = []
    for idx, w in enumerate(raw_weapons):
        w_entry = _find_entry(weapons_reg, str(w.get("asset_id") or w.get("name") or ""), fallback_idx=idx)
        fx_entry = _find_entry(effects_reg, str(w.get("vfx_id") or "slash"), fallback_idx=idx)
        wid = re.sub(r"[^a-zA-Z0-9_]", "_", w.get("weapon_id") or w.get("name") or f"weapon_{idx}").lower() + f"_{build_id[:4]}"
        normalized_weapons.append({
            "weapon_id": wid,
            "name": w.get("name") or f"{w_entry.get('id', 'Relic')} of {campaign.company_name}",
            "asset_id": w_entry.get("id", "sword_2handed"),
            "asset_url": w_entry.get("url", "/custom_assets/weapons_3d/sword_2handed.gltf"),
            "glb_url": w_entry.get("url", "/custom_assets/weapons_3d/sword_2handed.gltf"),
            "dimensions": w_entry.get("dimensions", [0.4, 0.2, 1.4]),
            "vfx_id": fx_entry.get("id", "slash"),
            "vfx_shader_url": fx_entry.get("url", "/custom_assets/effects_3d_2d/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/slash.gdshader"),
            "element_type": w.get("element_type", ["FIRE", "LIGHTNING", "NECROTIC", "HOLY"][idx % 4]),
            "shader_color_hex": w.get("shader_color_hex", ["#f97316", "#38bdf8", "#a855f7", "#eab308"][idx % 4]),
            "base_damage": int(w.get("base_damage", 70 + idx * 10)),
            "poise_damage": int(w.get("poise_damage", 85 + idx * 12)),
            "procedural_spec": {
                "archetype": "GREATSWORD" if idx % 2 == 0 else "HALBERD",
                "blade_length": 1.25,
                "blade_width": 0.14,
                "guard_style": "WINGED",
                "fuller_groove": True,
                "serrated_edge": False,
                "metallic_roughness": 0.22,
                "emission_strength": 4.5
            }
        })
    raw_config["weapons"] = normalized_weapons

    # Helper lookup for ModularCastle + KayKit Dungeon 1.1 environment pieces
    floor_candidates = [e for e in env_reg if "floor_" in e["id"].lower()] or env_reg
    wall_candidates = [e for e in env_reg if "wall_mid" in e["id"].lower() or "wall_arched" in e["id"].lower() or "wall" in e["id"].lower()] or env_reg
    arch_candidates = [e for e in env_reg if "arch_" in e["id"].lower() or "door" in e["id"].lower()] or env_reg
    torch_candidates = [e for e in env_reg if "torch" in e["id"].lower() or "lamp" in e["id"].lower()] or env_reg
    prop_candidates = [
        e for e in env_reg
        if any(k in e["id"].lower() for k in ["barrel", "crate", "table", "banner", "platform", "carpet", "chest", "coffin", "shelves", "fountain", "pillar", "column"])
    ] or env_reg

    llm_rooms = raw_config.get("rooms", [])
    if not isinstance(llm_rooms, list):
        llm_rooms = []

    questions = survey_questions
    num_q = max(1, len(questions))

    torch_colors = ["#ff7b29", "#38bdf8", "#a855f7", "#22c55e", "#f43f5e", "#eab308"]
    fog_colors = ["#0b0e17", "#110c1d", "#091518", "#190d0d", "#0d131a", "#14110b"]
    skill_checks = [
        {"skill": "Persuasion", "dc": 12, "stat": "CHA"},
        {"skill": "Arcana", "dc": 14, "stat": "INT"},
        {"skill": "Intimidation", "dc": 15, "stat": "STR"},
        {"skill": "Insight", "dc": 11, "stat": "WIS"},
    ]

    normalized_rooms = []
    current_z_offset = 0.0

    for r_idx in range(target_rooms):
        is_boss_room = (r_idx == target_rooms - 1)
        src_room = llm_rooms[r_idx] if r_idx < len(llm_rooms) else (llm_rooms[r_idx % len(llm_rooms)].copy() if llm_rooms else {})
        q_obj = questions[r_idx % num_q]
        opts = q_obj.options if q_obj.options else ["Aggressive Breach", "Analytical Bypass", "Diplomatic Pact", "Alchemical Synthesis"]

        width = 18 if not is_boss_room else 24
        depth = 20 if r_idx == 0 else (24 if not is_boss_room else 26)
        room_center_z = current_z_offset - (depth / 2.0)

        room_id = f"room_{r_idx + 1}"
        default_rnames = [
            f"Courtyard & Forge Hub of {campaign.company_name}",
            f"Catacombs & Lever Gate of {campaign.company_name}",
            f"Sanctum Chamber of {campaign.company_name}",
            f"Sovereign Cathedral (Boss Arena) of {campaign.company_name}"
        ]
        r_name = src_room.get("name") or (default_rnames[r_idx] if r_idx < len(default_rnames) else f"Sector {r_idx + 1}")
        if is_boss_room and "boss" not in r_name.lower() and "arena" not in r_name.lower():
            r_name = f"{r_name} (Boss Arena)"

        lighting = src_room.get("lighting") if isinstance(src_room.get("lighting"), dict) else {}
        is_flashlight = bool(genre_profile.get("flashlight_mode", False))
        lighting_norm = {
            "fog_hex": "#05070b" if is_flashlight else lighting.get("fog_hex", fog_colors[r_idx % len(fog_colors)]),
            "torch_color_hex": "#ef4444" if is_flashlight else lighting.get("torch_color_hex", torch_colors[r_idx % len(torch_colors)]),
            "ambient_intensity": 0.25 if is_flashlight else float(lighting.get("ambient_intensity", 0.62))
        }

        floor_entry = _find_entry(floor_candidates, str(src_room.get("floor_style", "Floor_2x2")), fallback_idx=r_idx)
        wall_entry = _find_entry(wall_candidates, str(src_room.get("wall_style", "Wall_Mid_x2")), fallback_idx=r_idx)
        arch_entry = _find_entry(arch_candidates, str(src_room.get("arch_style", "Arch_Segment_Full")), fallback_idx=r_idx)
        torch_entry = _find_entry(torch_candidates, "Wall_Holder_Torch", fallback_idx=r_idx)
        pillar_entry = _find_entry(env_reg, "Arch_Decor_Wide_x2", fallback_idx=r_idx)

        # Normalize props from ModularCastle + KayKit Dungeon 1.1
        raw_props = src_room.get("props") if isinstance(src_room.get("props"), list) else []
        norm_props = []
        for p_idx, p in enumerate(raw_props[:4]):
            p_entry = _find_entry(prop_candidates, str(p.get("asset", "Crate_Long")), fallback_idx=p_idx + r_idx)
            norm_props.append({
                "prop_id": f"prop_r{r_idx + 1}_{p_idx + 1}",
                "asset": p_entry.get("id", "Crate_Long"),
                "asset_url": p_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Decoration/Crate_Long.glb"),
                "dimensions": p_entry.get("dimensions", [1.0, 1.0, 1.0]),
                "ground_offset_y": p_entry.get("ground_offset_y", 0.0),
                "x": float(p.get("x", (-4.5 if p_idx % 2 == 0 else 4.5))),
                "z": float(p.get("z", (-2.5 + p_idx * 1.5))),
                "rot_y": float(p.get("rot_y", 0.0)),
                "interactive_tag": p.get("interactive_tag", "movable_prop"),
                "movable": True,
                "trap_dc": 11 if p_idx == 0 else 0,
            })

        barrel_entry = _find_entry(env_reg, "Barrel", fallback_idx=0)
        chest_entry = _find_entry(weapons_reg + env_reg, "chest_gold", fallback_idx=0)
        crystal_entry = _find_entry(env_reg, "Floating_Platform_Crystal", fallback_idx=0)

        # Zone 1: Courtyard & Forge Hub (Survey Forge Anvils dynamically bound to Question 1 Options)
        if r_idx == 0:
            first_q = questions[0] if questions else None
            tier_1_title = first_q.options[0] if (first_q and len(first_q.options) > 0) else "Primary Choice"
            tier_2_title = first_q.options[1] if (first_q and len(first_q.options) > 1) else "Alternative Choice"
            norm_props.append({
                "prop_id": "forge_primary_opt",
                "asset": "Anvil_Primary",
                "asset_url": "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Decoration/Table_Long.glb",
                "dimensions": [1.8, 1.2, 1.2],
                "ground_offset_y": 0.0,
                "x": -4.2,
                "z": 1.5,
                "rot_y": 0.0,
                "interactive_tag": "survey_forge",
                "tier_name": tier_1_title,
                "cost_gold": 10,
                "weapon_id": normalized_weapons[0]["weapon_id"],
                "weapon_name": normalized_weapons[0]["name"],
                "vfx_shader_url": "/custom_assets/effects_3d_2d/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/shield_aura.gdshader"
            })
            norm_props.append({
                "prop_id": "forge_secondary_opt",
                "asset": "Anvil_Secondary",
                "asset_url": "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Decoration/Table_Small.glb",
                "dimensions": [1.4, 1.1, 1.1],
                "ground_offset_y": 0.0,
                "x": 4.2,
                "z": 1.5,
                "rot_y": 0.0,
                "interactive_tag": "survey_forge",
                "tier_name": tier_2_title,
                "cost_gold": 2,
                "weapon_id": normalized_weapons[1]["weapon_id"],
                "weapon_name": normalized_weapons[1]["name"],
                "vfx_shader_url": "/custom_assets/effects_3d_2d/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/slash.gdshader"
            })

        # Zone 2: Catacombs & Lever Gate (Mechanical Lever + Solid Iron Gate + Treasure Chest)
        elif r_idx == 1:
            norm_props.append({
                "prop_id": "lever_zone2",
                "asset": "Mechanical_Lever",
                "asset_url": "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Lighting_Fixtures/Wall_Holder_Torch.glb",
                "dimensions": [0.8, 1.5, 0.8],
                "ground_offset_y": 0.0,
                "x": 4.5,
                "z": -1.2,
                "rot_y": -1.57,
                "interactive_tag": "mechanical_lever",
                "linked_gate_id": "gate_room_2",
                "label": "Pull Heavy Bronze Lever"
            })
            norm_props.append({
                "prop_id": "chest_catacombs",
                "asset": "Treasure_Chest",
                "asset_url": "/custom_assets/weapons_3d/chest_gold.glb",
                "dimensions": [1.6, 1.2, 1.2],
                "ground_offset_y": 0.0,
                "x": -4.2,
                "z": -2.2,
                "rot_y": 0.35,
                "interactive_tag": "treasure_chest",
                "gold_reward": 10,
                "opened": False
            })

        # Zone 3: Faction Sanctum (Treasure Chest 2 + Covenant Shrine)
        elif r_idx == 2:
            norm_props.append({
                "prop_id": "chest_sanctum",
                "asset": "Treasure_Chest",
                "asset_url": "/custom_assets/weapons_3d/chest_gold.glb",
                "dimensions": [1.6, 1.2, 1.2],
                "ground_offset_y": 0.0,
                "x": 4.5,
                "z": -2.5,
                "rot_y": -0.4,
                "interactive_tag": "treasure_chest",
                "gold_reward": 10,
                "opened": False
            })

        if not any(p.get("interactive_tag") == "flammable_barrel" for p in norm_props):
            norm_props.append({
                "prop_id": f"barrel_r{r_idx + 1}",
                "asset": barrel_entry.get("id", "Barrel"),
                "asset_url": barrel_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Decoration/Barrel.glb"),
                "dimensions": barrel_entry.get("dimensions", [1.0, 1.0, 1.5]),
                "ground_offset_y": barrel_entry.get("ground_offset_y", 0.75),
                "x": 4.5 if r_idx % 2 == 0 else -4.5,
                "z": -2.5,
                "rot_y": 0.0,
                "interactive_tag": "flammable_barrel",
                "movable": True,
                "vfx_shader_url": "/custom_assets/effects_3d_2d/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/shield_aura.gdshader"
            })
        if not any(p.get("interactive_tag") == "loot_shrine" for p in norm_props) and r_idx > 0:
            norm_props.append({
                "prop_id": f"shrine_r{r_idx + 1}",
                "asset": chest_entry.get("id", "chest_gold"),
                "asset_url": chest_entry.get("url", "/custom_assets/weapons_3d/chest_gold.glb"),
                "dimensions": chest_entry.get("dimensions", [1.7, 1.4, 1.3]),
                "ground_offset_y": chest_entry.get("ground_offset_y", 0.0),
                "x": -4.8,
                "z": -3.5,
                "rot_y": 0.4,
                "interactive_tag": "loot_shrine",
                "movable": False,
                "covenant_shrine": True,
            })
        if is_boss_room and crystal_entry:
            norm_props.append({
                "prop_id": f"boss_shrine_r{r_idx + 1}",
                "asset": crystal_entry.get("id", "Floating_Platform_Crystal"),
                "asset_url": crystal_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Decoration/Floating_Platform_Crystal.glb"),
                "dimensions": crystal_entry.get("dimensions", [3.0, 3.0, 3.0]),
                "ground_offset_y": crystal_entry.get("ground_offset_y", 0.0),
                "x": 0.0,
                "z": -4.5,
                "rot_y": 0.0,
                "interactive_tag": "boss_crystal_shrine",
                "covenant_shrine": True,
            })

        # Normalize NPC with D20 Skill Checks & Covenant Shrine Vows
        raw_npc = src_room.get("npc") if isinstance(src_room.get("npc"), dict) else {}
        npc_entry = _find_entry(chars, str(raw_npc.get("model", "")), fallback_idx=(r_idx + 1))
        npc_is_65 = (npc_entry.get("bones_count", 0) == 65)

        npc_choices = []
        for o_idx, opt_text in enumerate(opts):
            granted_w = normalized_weapons[o_idx % len(normalized_weapons)]["weapon_id"]
            sc = skill_checks[o_idx % len(skill_checks)]
            npc_choices.append({
                "choice_text": opt_text,
                "survey_option_mapped": opt_text,
                "metric_delta": round(1.5 - (o_idx * 0.35), 2),
                "grants_weapon_id": granted_w,
                "skill_check": f"{sc['skill']} [DC {sc['dc']}]",
                "skill_name": sc["skill"],
                "dc": sc["dc"],
                "covenant_vow": f"Vow of {opt_text}",
            })

        norm_npc = {
            "npc_id": f"npc_{r_idx + 1}",
            "name": raw_npc.get("name") or f"Envoy of {q_obj.target_metric.replace('_', ' ').title()}",
            "model": npc_entry.get("id", "Female_Ranger"),
            "asset_url": npc_entry.get("url", "/custom_assets/characters_3d/fantasy_outfits/Female_Ranger.gltf"),
            "bones_count": npc_entry.get("bones_count", 65),
            "dimensions": npc_entry.get("dimensions", [1.9, 2.0, 2.8]),
            "ground_offset_y": npc_entry.get("ground_offset_y", 0.0),
            "idle_anim": "Idle_Talking_Loop" if npc_is_65 else "Idle",
            "x": float(raw_npc.get("x", -4.2)),
            "z": float(raw_npc.get("z", 1.5)),
            "question_id": q_obj.id,
            "question_text": q_obj.question_text,
            "target_metric": q_obj.target_metric,
            "options": opts,
            "choices": npc_choices,
            "patrol_barks": [
                f"Halt! Have you weighed the matter of {q_obj.target_metric.replace('_', ' ')}?",
                "Keep your blade sheathed near the guild shrine, stranger.",
                "Every choice in this keep reshapes our order."
            ]
        }

        # Normalize Enemies using genre_profile preferred_enemies + combined Skeletons/PSX/Quaternius Monsters
        pref_enemy_ids = genre_profile.get("preferred_enemies") or ["Skeleton_Warrior", "Dragon", "Bat"]
        target_enemy_count = int(genre_profile.get("enemy_count_per_room", 2))
        raw_enemies = src_room.get("enemies") if isinstance(src_room.get("enemies"), list) else []
        if not raw_enemies or genre_profile.get("is_custom_genre"):
            raw_enemies = []
            spawn_count = max(1, min(4, target_enemy_count if not is_boss_room else max(2, target_enemy_count)))
            for s_idx in range(spawn_count):
                arch_pick = pref_enemy_ids[(r_idx + s_idx) % len(pref_enemy_ids)]
                is_lead_boss = is_boss_room and (s_idx == 0)
                raw_enemies.append({
                    "archetype": "Dragon" if (is_lead_boss and "Dragon" in pref_enemy_ids) else arch_pick,
                    "name": (
                        f"Arch-Sovereign of {campaign.company_name}" if is_lead_boss
                        else f"{arch_pick.replace('_', ' ').title()} of {q_obj.target_metric.replace('_', ' ').title()}"
                    ),
                    "hp": 340 if is_lead_boss else (115 if spawn_count >= 3 else 145),
                    "poise": 160 if is_lead_boss else 80,
                    "speed": (3.8 if is_lead_boss else 3.2) * float(genre_profile.get("movement_speed_mult", 1.0)),
                    "attack_anim": "2H_Melee_Attack_Spin" if is_lead_boss else "1H_Melee_Attack_Slice_Diagonal",
                    "vfx_id": "claw" if is_lead_boss else "slash",
                    "x": 0.0 if is_lead_boss else (3.2 - s_idx * 3.0),
                    "z": -1.5 if is_lead_boss else (0.5 - s_idx * 1.8)
                })

        norm_enemies = []
        for e_idx, e in enumerate(raw_enemies[:4]):
            e_entry = _find_entry(enemies_reg + chars, str(e.get("archetype", "")), fallback_idx=(r_idx + e_idx))
            fx_entry = _find_entry(effects_reg, str(e.get("vfx_id", "slash")), fallback_idx=e_idx)
            e_is_65 = (e_entry.get("bones_count", 0) == 65)
            hp_val = int(e.get("hp", 340 if is_boss_room else 140))
            poise_val = int(e.get("poise", 160 if is_boss_room else 80))
            norm_enemies.append({
                "enemy_id": f"enemy_r{r_idx + 1}_{e_idx + 1}",
                "archetype": e_entry.get("id", "Skeleton_Warrior"),
                "asset_url": e_entry.get("url", "/custom_assets/enemies_3d/Skeleton_Warrior.glb"),
                "bones_count": e_entry.get("bones_count", 41),
                "dimensions": e_entry.get("dimensions", [1.9, 2.0, 3.5]),
                "ground_offset_y": e_entry.get("ground_offset_y", 1.0),
                "target_height_m": 2.65 if (is_boss_room and e_idx == 0) else 1.9,
                "name": e.get("name") or (f"Overlord of {campaign.company_name}" if is_boss_room else f"Dread {e_entry.get('id', 'Warrior')}"),
                "hp": hp_val,
                "max_hp": hp_val,
                "poise": poise_val,
                "max_poise": poise_val,
                "speed": float(e.get("speed", 3.4)),
                "damage": 24 if is_boss_room else 15,
                "idle_anim": "Sword_Idle" if e_is_65 else "Idle",
                "run_anim": "Jog_Fwd_Loop" if e_is_65 else "Running_A",
                "hit_anim": "Hit_Chest" if e_is_65 else "Hit_A",
                "death_anim": "Death01" if e_is_65 else "Death_A",
                "attack_anim": (
                    "Sword_Heavy_Combo" if e_is_65 else (
                        e.get("attack_anim") if e.get("attack_anim") in e_entry.get("animations", [])
                        else ("2H_Melee_Attack_Spin" if is_boss_room else "1H_Melee_Attack_Slice_Diagonal")
                    )
                ),
                "vfx_id": fx_entry.get("id", "slash"),
                "vfx_shader_url": fx_entry.get("url", "/custom_assets/effects_3d_2d/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/slash.gdshader"),
                "x": float(e.get("x", 0.0 if is_boss_room else (2.5 - e_idx * 3.5))),
                "z": float(e.get("z", -1.0 if is_boss_room else (0.5 - e_idx * 2.0))),
                "is_boss": is_boss_room and (e_idx == 0),
                "question_id": q_obj.id,
                "mapped_option": opts[0],
                "guard_barks": [
                    "Intruder sighted! Raise the alarm!",
                    "Hold the line—protect the sanctum!",
                    "Wait... what was that noise by the barrels?"
                ]
            })

        opt_0 = opts[0] if len(opts) > 0 else "Aggressive Action"
        opt_1 = opts[1] if len(opts) > 1 else opts[0]
        opt_2 = opts[2] if len(opts) > 2 else opts[-1]
        opt_3 = opts[3] if len(opts) > 3 else opts[0]

        immersive_sim_puzzle = {
            "question_id": q_obj.id,
            "question_text": q_obj.question_text,
            "flammable_barrel": {
                "x": 4.5,
                "z": -2.5,
                "maps_to_option": opt_0,
                "label": f"[1] Alchemy / Ignite Barrel ({opt_0})"
            },
            "locked_gate": {
                "x": 0.0,
                "z": -(depth / 2.0) + 0.5,
                "maps_to_option": opt_1,
                "label": f"[2] Stealth / Pick Portcullis Lock ({opt_1})"
            },
            "bribe_guard": {
                "x": norm_npc["x"],
                "z": norm_npc["z"],
                "maps_to_option": opt_2,
                "label": f"[3] Diplomatic Parley ({opt_2})"
            },
            "combat_solution": {
                "maps_to_option": opt_3,
                "label": f"[4] Direct Martial Conquest ({opt_3})"
            }
        }

        normalized_rooms.append({
            "room_id": room_id,
            "room_index": r_idx,
            "name": r_name,
            "is_boss_arena": is_boss_room,
            "width": width,
            "depth": depth,
            "offset_x": 0.0,
            "offset_z": room_center_z,
            "lighting": lighting_norm,
            "wall_style": wall_entry.get("id", "Wall_Mid_x2"),
            "floor_style": floor_entry.get("id", "Floor_2x2"),
            "arch_style": arch_entry.get("id", "Arch_Segment_Full"),
            "wall_asset_url": wall_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Walls/Walls_Variable_Height/Wall_Mid_x2.glb"),
            "floor_asset_url": floor_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Floors&Ramps/Floors/Floor_2x2.glb"),
            "pillar_asset_url": pillar_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Walls/Wall_Decoration/Arch_Decor_Wide_x2.glb"),
            "doorway_asset_url": arch_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Walls/Arches/Arch_Segment_Full.glb"),
            "gate_asset_url": arch_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Walls/Arches/Arch_Segment_Full_x2.glb"),
            "torch_asset_url": torch_entry.get("url", "/custom_assets/environments_3d/ModularCastle_AssetPack/Props/Lighting_Fixtures/Wall_Holder_Torch.glb"),
            "props": norm_props,
            "enemies": norm_enemies,
            "npc": norm_npc,
            "immersive_sim_puzzle": immersive_sim_puzzle
        })

        current_z_offset -= depth

    raw_config["rooms"] = normalized_rooms

    survey_encounters = []
    for q_idx, q_obj in enumerate(questions):
        bound_room = normalized_rooms[q_idx % len(normalized_rooms)]
        npc_data = bound_room["npc"]
        puz = bound_room["immersive_sim_puzzle"]
        survey_encounters.append({
            "question_id": q_obj.id,
            "room_id": bound_room["room_id"],
            "room_name": bound_room["name"],
            "npc_name": npc_data["name"],
            "npc_model": npc_data["model"],
            "dialogue_prompt": q_obj.question_text,
            "target_metric": q_obj.target_metric,
            "choices": npc_data["choices"],
            "immersive_sim_affordances": {
                "chemistry_burn_metric_option": puz["flammable_barrel"]["maps_to_option"],
                "stealth_lockpick_metric_option": puz["locked_gate"]["maps_to_option"],
                "combat_bypass_metric_option": puz["bribe_guard"]["maps_to_option"]
            }
        })
    raw_config["survey_encounters"] = survey_encounters
    raw_config["survey_questions"] = [
        {"id": q.id, "question_text": q.question_text, "target_metric": q.target_metric, "options": q.options}
        for q in questions
    ]
    raw_config["survey_intent"] = campaign.survey_intent or ""

    # Automatically generate corresponding Godot 4 .tscn scene and .gd config
    try:
        godot_scene_meta = compile_godot_scene_from_config(raw_config)
        raw_config["godot_scene"] = godot_scene_meta
    except Exception as e:
        print(f"[GodotSceneCompiler] Warning: {e}")

    print(
        f"[AMD Token Factory Compiler] Build {build_id} | Compiled {dimension} {style_mode} '{raw_config.get('campaign_title')}' "
        f"| Hero: {player_config['id']} | Rooms: {len(normalized_rooms)}"
    )
    return raw_config
