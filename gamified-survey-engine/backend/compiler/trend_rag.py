import json
import math
import re
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional

STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage"
CHROMA_DIR = STORAGE_DIR / "trend_vectordb"
BACKUP_TRENDS_FILE = STORAGE_DIR / "trends_backup.json"

SEEDED_TRENDS = [
    {
        "trend_id": "trend_genz_dark_aesthetic",
        "demographic_tags": ["gen z", "college", "young adult", "gothic", "souls", "tiktok"],
        "trend_summary": "Gothic neo-medieval grunge aesthetic with dark souls combat, ethereal violet lights, and high difficulty bragging rights.",
        "visual_palette_hex": ["#0b0c10", "#1f2833", "#c5c6c7", "#66fcf1", "#45a29e"],
        "shader_style": "Dark Vignette with Chromatic Aberration & Additive Spark Embers",
        "slang_and_tone": "Deadass, cooked, lock in, clutch up, no cap, maidenless",
        "gameplay_hook": "Ultra-tight 200ms parry windows with explosive critical riposte animations.",
        "recommended_genre": "DARK_SOULS_ACTION",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_genz_vampire_bullet_heaven",
        "demographic_tags": ["gen z", "fast paced", "arcade", "roguelike", "dopamine", "bullet heaven"],
        "trend_summary": "Auto-firing dopamine swarm survival where 360-degree weapon evolution triggers massive screen-clearing fireworks.",
        "visual_palette_hex": ["#18002e", "#79008f", "#ff007f", "#00f0ff", "#ffe600"],
        "shader_style": "Hyper-saturated Neon Synthwave Bloom & Screen Shake",
        "slang_and_tone": "Absolute cinema, maxed out, infinite aura, dopamine hits",
        "gameplay_hook": "Swarm density scales with player XP; picking upgrades freezes time for tactical choice.",
        "recommended_genre": "HORDE_SURVIVOR_ARENA",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_millennial_crpg_tactics",
        "demographic_tags": ["millennial", "dnd", "tabletop", "baldurs gate", "tactical", "story"],
        "trend_summary": "Rich isometric narrative with turn-based action economy, 5-slot spellbars, and animated D20 skill check dice rolls.",
        "visual_palette_hex": ["#1a1423", "#3d314a", "#684756", "#ab8476", "#e5c3a6"],
        "shader_style": "Warm Candlelit Volumetric Fog with Crisp Cel-Shaded Outlines",
        "slang_and_tone": "Natural 20, min-maxing, initiative order, ethical dilemma, faction alignment",
        "gameplay_hook": "D20 skill checks on every NPC dialogue option and interactive chest lock.",
        "recommended_genre": "BALDURS_GATE_CRPG",
        "recommended_cartridge": "baldurs_gate_tactical_keep"
    },
    {
        "trend_id": "trend_retro_immersive_sandbox",
        "demographic_tags": ["millennial", "retro", "ultima", "dos", "immersive sim", "pixel art"],
        "trend_summary": "Living systemic fantasy world where every barrel is movable/ignitable, torches toggle stealth, and NPCs bark based on crime.",
        "visual_palette_hex": ["#2b2b26", "#4d4a3b", "#706c55", "#999373", "#c7c099"],
        "shader_style": "Retro CRT Scanline Curvature with 16-color dithering",
        "slang_and_tone": "Systemic sandbox, virtue tests, Britannia calls, avatar of justice",
        "gameplay_hook": "Pick up, stack, or throw props to bypass obstacles without engaging in combat.",
        "recommended_genre": "ULTIMA_IMMERSIVE_SANDBOX",
        "recommended_cartridge": "ultima_2d_living_town"
    },
    {
        "trend_id": "trend_psx_liminal_horror",
        "demographic_tags": ["gen z", "horror", "psx", "retro 3d", "analog", "creepypasta"],
        "trend_summary": "Low-poly PS1 aesthetic with gritty textures, flickering flashlight cones, and psychological stalker survival.",
        "visual_palette_hex": ["#05080c", "#121b24", "#243340", "#ef4444", "#fef08a"],
        "shader_style": "PS1 Affine Texture Jitter, Low-Bit Depth Dither & Fog",
        "slang_and_tone": "Eerie liminal space, found footage, uncanny valley, backrooms",
        "gameplay_hook": "Real-time flashlight battery management with disorienting fixed camera angles.",
        "recommended_genre": "PSX_SURVIVAL_HORROR",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_medieval_siege_tactics",
        "demographic_tags": ["gen z", "millennial", "strategy", "chivalry", "castle", "warfare"],
        "trend_summary": "Visceral castle rampart assault with ballistas, iron barricades, warhorns, and phalanx shield marches.",
        "visual_palette_hex": ["#1c1917", "#44403c", "#78716c", "#f59e0b", "#ef4444"],
        "shader_style": "Stone Dust Particle Fields & Metallic Anisotropic Blade Glints",
        "slang_and_tone": "Hold the line, breach the gate, vanguard assault, sovereign decree",
        "gameplay_hook": "Destructible wooden barricades that can be shattered by heavy greatsword attacks or fire barrels.",
        "recommended_genre": "CASTLE_SIEGE_WARFARE",
        "recommended_cartridge": "baldurs_gate_tactical_keep"
    },
    {
        "trend_id": "trend_noir_investigation_mystery",
        "demographic_tags": ["millennial", "mystery", "detective", "cozy crime", "puzzle"],
        "trend_summary": "Rain-slicked gothic courtyard investigation with hidden clue notes, lockpick minigames, and witness interrogation.",
        "visual_palette_hex": ["#090d16", "#1e293b", "#334155", "#60a5fa", "#fde047"],
        "shader_style": "Rain Droplet Ripple Distortion & Streetlamp Light Cones",
        "slang_and_tone": "The ledger doesn't lie, follow the money, prime suspect, deduction",
        "gameplay_hook": "Bribe guards with looted gold or pick vault locks to discover survey evidence.",
        "recommended_genre": "MYSTERY_INVESTIGATION",
        "recommended_cartridge": "ultima_2d_living_town"
    },
    {
        "trend_id": "trend_genz_cozy_cottage_alchemy",
        "demographic_tags": ["gen z", "female", "cozy", "alchemy", "crafting", "wholesome"],
        "trend_summary": "Relaxed mystical alchemy crafting where players forage glowing crystals, brew potions, and negotiate peacefully with guardians.",
        "visual_palette_hex": ["#1c2826", "#486358", "#8ba888", "#c0d6b9", "#f4f1de"],
        "shader_style": "Pastel Water Color Shading with Soft Ambient Glow",
        "slang_and_tone": "Cozy vibes, healing energy, alchemical flow, mindful decisions",
        "gameplay_hook": "Non-violent potion bribery to bypass boss encounters.",
        "recommended_genre": "ULTIMA_IMMERSIVE_SANDBOX",
        "recommended_cartridge": "ultima_2d_living_town"
    },
    {
        "trend_id": "trend_hardcore_speedrunner_dungeon",
        "demographic_tags": ["gen z", "esports", "competitive", "speedrun", "twitch"],
        "trend_summary": "Precision movement gauntlet with frame-perfect dodge rolls, animation cancelling, and leaderboard timer milestones.",
        "visual_palette_hex": ["#000000", "#111111", "#ff0055", "#00ffff", "#ffffff"],
        "shader_style": "High-Contrast Speed Lines with Motion Blur",
        "slang_and_tone": "Frame-perfect, PB pace, tech skill, cracked, sub-3 minutes",
        "gameplay_hook": "Split-second stamina meter management rewarding zero-damage flawless runs.",
        "recommended_genre": "DARK_SOULS_ACTION",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_anime_hack_and_slash",
        "demographic_tags": ["gen z", "anime", "action", "stylish", "combo"],
        "trend_summary": "Aerial combo chaining, elemental weapon swapping, and stylish rank ratings during battle.",
        "visual_palette_hex": ["#0f172a", "#3b82f6", "#ec4899", "#f59e0b", "#10b981"],
        "shader_style": "Cel-shaded Anime Line Art with Spark Burst Billboard VFX",
        "slang_and_tone": "Smokin' sexy style, combo meter, bankai release, full send",
        "gameplay_hook": "Switching between elemental weapons mid-combo grants bonus damage multipliers.",
        "recommended_genre": "DARK_SOULS_ACTION",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_dungeon_crawler_classic",
        "demographic_tags": ["millennial", "classic", "rpg", "wizardry", "grid"],
        "trend_summary": "Step-by-step dungeon exploration with trap detection, secret illusory walls, and resource management.",
        "visual_palette_hex": ["#1c1917", "#292524", "#57534e", "#a8a29e", "#e7e5e4"],
        "shader_style": "Dungeon Stone Ambient Occlusion & Dynamic Torch Flickering",
        "slang_and_tone": "Map every corridor, conserve torches, watch for mimic chests",
        "gameplay_hook": "Secret wall triggers activated by finding and pulling hidden torch wall sconces.",
        "recommended_genre": "BALDURS_GATE_CRPG",
        "recommended_cartridge": "baldurs_gate_tactical_keep"
    },
    {
        "trend_id": "trend_looter_slasher_economic",
        "demographic_tags": ["gen z", "millennial", "loot", "economy", "microtransactions", "arpg"],
        "trend_summary": "Treasure chest hunting where rare weapons drop colored loot pillars and players spend gold at rival merchant forges.",
        "visual_palette_hex": ["#0a0a0a", "#171717", "#f59e0b", "#8b5cf6", "#3b82f6"],
        "shader_style": "Borderlands Style Colored Loot Beams & Metallic Item Shimmer",
        "slang_and_tone": "God roll, legendary tier, value proposition, micro-upgrade, ROI",
        "gameplay_hook": "Competing $10 Premium Anvil vs $2 Consumable Merchant choices measuring purchasing intent directly in gameplay.",
        "recommended_genre": "DARK_SOULS_ACTION",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_cyber_fantasy_hybrid",
        "demographic_tags": ["gen z", "cyberpunk", "fantasy", "synthwave", "future"],
        "trend_summary": "Enchanted circuit boards and neon longswords where arcane rituals hack biometric security gates.",
        "visual_palette_hex": ["#050510", "#18182f", "#00ffff", "#ff007f", "#7928ca"],
        "shader_style": "Holographic Glitch Distortion with Neon Edge Glow",
        "slang_and_tone": "Netrunner knight, decrypt sanctum, overclocked mana, cyber-paladin",
        "gameplay_hook": "EMP shockwave spells that stun mechanical enemies and disable laser traps.",
        "recommended_genre": "BALDURS_GATE_CRPG",
        "recommended_cartridge": "baldurs_gate_tactical_keep"
    },
    {
        "trend_id": "trend_eldritch_cosmic_horror",
        "demographic_tags": ["millennial", "gen z", "lovecraft", "cosmic horror", "bloodborne"],
        "trend_summary": "Unfathomable tentacles and astrological altars where sanity meters deplete when witnessing eldritch truths.",
        "visual_palette_hex": ["#030712", "#111827", "#374151", "#7c3aed", "#10b981"],
        "shader_style": "Insanity Eye Pulse Vignette & Cosmic Nebular Lighting",
        "slang_and_tone": "Grant us eyes, insight gained, celestial communion, dread omen",
        "gameplay_hook": "High-insight reveals hidden dialogue options with shadowy deities at the expense of player defense.",
        "recommended_genre": "DARK_SOULS_ACTION",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    },
    {
        "trend_id": "trend_folk_horror_cryptid",
        "demographic_tags": ["gen z", "folk horror", "cryptid", "wilderness", "survival"],
        "trend_summary": "Isolated autumn woods and decaying wooden shacks where pagan idols grant strange blessings.",
        "visual_palette_hex": ["#1a120b", "#3c2a21", "#543a2c", "#d5cea3", "#e5e5cb"],
        "shader_style": "Faded 16mm Film Grain & Sepia Fog Mist",
        "slang_and_tone": "The forest watches, blood offering, ancient harvest, appease the woods",
        "gameplay_hook": "Offer weapons to bone shrines to gain immunity to curse fog.",
        "recommended_genre": "PSX_SURVIVAL_HORROR",
        "recommended_cartridge": "dark_souls_cathedral_gauntlet"
    }
]


def _compute_dense_vector(text: str, dim: int = 128) -> List[float]:
    """
    Computes a deterministic, normalized 128-dimensional dense feature embedding
    in pure Python without requiring heavyweight 100MB model downloads.
    """
    words = re.findall(r"[a-zA-Z0-9_]+", text.lower())
    vec = [0.0] * dim
    for idx, w in enumerate(words):
        h = hash(w) % dim
        vec[h] += 1.0 + (1.0 / (idx + 1))
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


class FastChromaEmbeddingFunction:
    def __call__(self, input: Any) -> List[List[float]]:
        if isinstance(input, str):
            return [_compute_dense_vector(input)]
        return [_compute_dense_vector(str(t)) for t in input]

    def name(self) -> str:
        return "FastChromaEmbeddingFunction"

    def embed_query(self, input: Any = None, query: Any = None, **kwargs) -> Any:
        inp = input if input is not None else (query or "")
        if isinstance(inp, str):
            return [_compute_dense_vector(inp)]
        return [_compute_dense_vector(str(t)) for t in inp]

    def embed_documents(self, input: Any = None, documents: Any = None, **kwargs) -> List[List[float]]:
        docs = input if input is not None else (documents or [])
        if isinstance(docs, str):
            return [_compute_dense_vector(docs)]
        return [_compute_dense_vector(str(t)) for t in docs]


class TrendRAG:
    def __init__(self):
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.chroma_client = None
        self.collection = None
        self._init_chromadb()

    def _init_chromadb(self):
        try:
            import chromadb
            self.chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
            # Use our ultra-fast zero-download local embedding function
            self.collection = self.chroma_client.get_or_create_collection(
                name="demographic_trends_v2",
                embedding_function=FastChromaEmbeddingFunction(),
                metadata={"hnsw:space": "cosine"}
            )
            if self.collection.count() == 0:
                self._seed_chromadb()
        except Exception as e:
            print(f"[TrendRAG] ChromaDB fallback mode: {e}")
            if not BACKUP_TRENDS_FILE.exists():
                BACKUP_TRENDS_FILE.write_text(json.dumps(SEEDED_TRENDS, indent=2))

    def _seed_chromadb(self):
        if not self.collection:
            return
        ids = [t["trend_id"] for t in SEEDED_TRENDS]
        documents = [
            f"{t['trend_summary']} Demographic tags: {', '.join(t['demographic_tags'])}. Hook: {t['gameplay_hook']} Slang: {t['slang_and_tone']}"
            for t in SEEDED_TRENDS
        ]
        metadatas = [
            {
                "trend_id": t["trend_id"],
                "visual_palette_hex": json.dumps(t["visual_palette_hex"]),
                "shader_style": t["shader_style"],
                "slang_and_tone": t["slang_and_tone"],
                "gameplay_hook": t["gameplay_hook"],
                "recommended_genre": t["recommended_genre"],
                "recommended_cartridge": t["recommended_cartridge"],
                "trend_summary": t["trend_summary"]
            }
            for t in SEEDED_TRENDS
        ]
        self.collection.add(ids=ids, documents=documents, metadatas=metadatas)
        BACKUP_TRENDS_FILE.write_text(json.dumps(SEEDED_TRENDS, indent=2))
        print(f"[TrendRAG] Successfully seeded {len(SEEDED_TRENDS)} trends into ChromaDB (Collection: demographic_trends_v2)")

    def add_trend(self, trend_dict: Dict[str, Any]) -> Dict[str, Any]:
        tid = trend_dict.get("trend_id") or f"trend_{uuid.uuid4().hex[:8]}"
        trend_dict["trend_id"] = tid
        summary = trend_dict.get("trend_summary", "Custom user submitted trend.")
        tags = trend_dict.get("demographic_tags", [])
        doc = f"{summary} Demographic tags: {', '.join(tags)}. Hook: {trend_dict.get('gameplay_hook', '')} Slang: {trend_dict.get('slang_and_tone', '')}"

        if self.collection:
            meta = {
                "trend_id": tid,
                "visual_palette_hex": json.dumps(trend_dict.get("visual_palette_hex", ["#6366f1", "#ef4444"])),
                "shader_style": trend_dict.get("shader_style", "Standard Dynamic Lighting"),
                "slang_and_tone": trend_dict.get("slang_and_tone", "Neutral"),
                "gameplay_hook": trend_dict.get("gameplay_hook", "Action Adventure"),
                "recommended_genre": trend_dict.get("recommended_genre", "DARK_SOULS_ACTION"),
                "recommended_cartridge": trend_dict.get("recommended_cartridge", "dark_souls_cathedral_gauntlet"),
                "trend_summary": summary
            }
            self.collection.add(ids=[tid], documents=[doc], metadatas=[meta])

        existing = self.list_all_trends()
        existing = [t for t in existing if t.get("trend_id") != tid]
        existing.append(trend_dict)
        BACKUP_TRENDS_FILE.write_text(json.dumps(existing, indent=2))
        return trend_dict

    def query_top_trend(self, query_text: str, n_results: int = 1) -> Dict[str, Any]:
        if self.collection and self.collection.count() > 0:
            try:
                res = self.collection.query(query_texts=[query_text], n_results=n_results)
                if res and res["metadatas"] and len(res["metadatas"][0]) > 0:
                    meta = res["metadatas"][0][0]
                    palette = json.loads(meta.get("visual_palette_hex", "[]")) if isinstance(meta.get("visual_palette_hex"), str) else meta.get("visual_palette_hex")
                    return {
                        "trend_id": meta.get("trend_id"),
                        "trend_summary": meta.get("trend_summary"),
                        "visual_palette_hex": palette,
                        "shader_style": meta.get("shader_style"),
                        "slang_and_tone": meta.get("slang_and_tone"),
                        "gameplay_hook": meta.get("gameplay_hook"),
                        "recommended_genre": meta.get("recommended_genre"),
                        "recommended_cartridge": meta.get("recommended_cartridge")
                    }
            except Exception as e:
                print(f"[TrendRAG] ChromaDB query notice: {e}")

        # In-memory keyword fallback
        trends = self.list_all_trends()
        q_low = query_text.lower()
        best_t = trends[0]
        max_score = -1
        for t in trends:
            score = 0
            for tag in t.get("demographic_tags", []):
                if tag in q_low:
                    score += 3
            if t.get("recommended_genre", "").lower() in q_low:
                score += 2
            if any(w in t.get("trend_summary", "").lower() for w in q_low.split()):
                score += 1
            if score > max_score:
                max_score = score
                best_t = t
        return best_t

    def list_all_trends(self) -> List[Dict[str, Any]]:
        if BACKUP_TRENDS_FILE.exists():
            try:
                return json.loads(BACKUP_TRENDS_FILE.read_text())
            except Exception:
                pass
        return SEEDED_TRENDS


trend_rag = TrendRAG()
