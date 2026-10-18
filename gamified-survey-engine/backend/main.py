import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.compiler.amd_client import amd_client
from backend.compiler.gemma4_architect import SurveyCampaignInput, compile_survey_to_game
from backend.compiler.trend_rag import trend_rag
from backend.compiler.cohort_profiler import (
    load_user_profiles,
    load_playtime_sessions,
    record_playtime_session,
    analyze_demographic_playtime_winner,
)
from backend.compiler.video_analyzer import analyze_combat_video_timings
from backend.pipelines.asset_generator import generate_weapon_glb
from backend.pipelines.motion_extractor import video_to_godot_animation
from backend.pipelines.sync_all_user_assets import sync_all_user_assets
from backend.pipelines.godot_scene_compiler import launch_native_godot_window, compile_godot_scene_from_config

app = FastAPI(title="Neuro-Symbolic AI Game Compiler - Multi-Role Studio & Godot 4 Edition")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
CUSTOM_ASSETS_DIR = REPO_ROOT / "custom_asset_packs"
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_GLB = STORAGE_DIR / "generated_glb"
STORAGE_ANIMS = STORAGE_DIR / "generated_anims"
STORAGE_CONFIGS = STORAGE_DIR / "configs"
USERS_DB_PATH = STORAGE_DIR / "users_db.json"
TELEMETRY_DB_PATH = STORAGE_DIR / "telemetry_db.json"

CUSTOM_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_GLB.mkdir(parents=True, exist_ok=True)
STORAGE_ANIMS.mkdir(parents=True, exist_ok=True)
STORAGE_CONFIGS.mkdir(parents=True, exist_ok=True)

app.mount("/custom_assets", StaticFiles(directory=str(CUSTOM_ASSETS_DIR)), name="custom_assets")
app.mount("/assets/glb", StaticFiles(directory=str(STORAGE_GLB)), name="glb")
app.mount("/assets/anims", StaticFiles(directory=str(STORAGE_ANIMS)), name="anims")


# --- Persistent User Store ---
def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _load_users() -> List[Dict[str, Any]]:
    if USERS_DB_PATH.exists():
        try:
            return json.loads(USERS_DB_PATH.read_text())
        except Exception:
            pass
    return []


def _save_users(users: List[Dict[str, Any]]) -> None:
    USERS_DB_PATH.write_text(json.dumps(users, indent=2))


# --- Persistent Telemetry Store ---
def _load_telemetry() -> List[Dict[str, Any]]:
    if TELEMETRY_DB_PATH.exists():
        try:
            return json.loads(TELEMETRY_DB_PATH.read_text())
        except Exception:
            pass
    return []


def _save_telemetry(events: List[Dict[str, Any]]) -> None:
    TELEMETRY_DB_PATH.write_text(json.dumps(events, indent=2))


TELEMETRY_LOG: List[Dict[str, Any]] = _load_telemetry()


class RegisterPayload(BaseModel):
    name: str
    email: str
    password: str
    role: str = "company"  # "company" or "player"
    organization: Optional[str] = None


class LoginPayload(BaseModel):
    email: str
    password: str


class TelemetryEvent(BaseModel):
    player_id: str
    game_id: Optional[str] = None
    question_id: str
    interaction_type: str  # "D20_DIALOGUE" | "COVENANT_SHRINE" | "SANDBOX_AFFORDANCE" | "COMBAT_KILL"
    selected_option: str
    metric_delta: float
    weapon_equipped: str


class AMDConfigPayload(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    text_model: Optional[str] = None
    vision_model: Optional[str] = None


class GodotLaunchPayload(BaseModel):
    game_id: Optional[str] = None


# --- Auth Endpoints ---
@app.post("/api/auth/register")
async def register_user(payload: RegisterPayload):
    users = _load_users()
    email_clean = payload.email.strip().lower()
    if not email_clean or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    for u in users:
        if u["email"] == email_clean:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

    role_norm = "company" if payload.role.lower() == "company" else "player"
    new_user = {
        "user_id": str(uuid.uuid4()),
        "name": payload.name.strip() or email_clean.split("@")[0],
        "email": email_clean,
        "password_hash": _hash_pw(payload.password),
        "role": role_norm,
        "organization": (payload.organization or payload.name or "Independent Studio").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    users.append(new_user)
    _save_users(users)

    user_public = {k: v for k, v in new_user.items() if k != "password_hash"}
    return {
        "status": "registered",
        "token": f"agy_{new_user['user_id']}",
        "user": user_public,
    }


@app.post("/api/auth/login")
async def login_user(payload: LoginPayload):
    users = _load_users()
    email_clean = payload.email.strip().lower()
    pw_hash = _hash_pw(payload.password)

    for u in users:
        if u["email"] == email_clean and u["password_hash"] == pw_hash:
            user_public = {k: v for k, v in u.items() if k != "password_hash"}
            return {
                "status": "authenticated",
                "token": f"agy_{u['user_id']}",
                "user": user_public,
            }

    raise HTTPException(status_code=401, detail="Invalid email or password.")


# --- AMD Config Endpoints ---
@app.post("/api/config-amd-key")
async def config_amd(payload: AMDConfigPayload):
    amd_client.configure(
        api_key=payload.api_key,
        base_url=payload.base_url,
        text_model=payload.text_model,
        vision_model=payload.vision_model
    )
    await amd_client.discover_models()
    return {
        "status": "updated",
        "client_status": amd_client.get_status()
    }


@app.get("/api/amd-status")
async def get_amd_status():
    await amd_client.discover_models()
    return amd_client.get_status()


# --- Asset Pack Management & Incremental Scanner ---
@app.get("/api/custom-assets")
async def get_custom_assets_registry():
    registry_path = CUSTOM_ASSETS_DIR / "asset_registry.json"
    if registry_path.exists():
        return json.loads(registry_path.read_text())
    return sync_all_user_assets()


@app.post("/api/assets/scan")
async def scan_user_assets_endpoint():
    registry = sync_all_user_assets()
    return {
        "status": "scanned",
        "summary": registry.get("summary", {}),
        "ingested_packs": registry.get("ingested_packs", []),
        "registry": registry,
    }


# --- Campaign Compiler & Library Endpoints ---
@app.post("/api/compile")
@app.post("/api/compile-campaign")
async def create_campaign(campaign: SurveyCampaignInput):
    game_config = await compile_survey_to_game(campaign)
    for weapon in game_config.get("weapons", []):
        if weapon.get("asset_url") and str(weapon["asset_url"]).startswith("/custom_assets/"):
            weapon["glb_url"] = weapon["asset_url"]
        else:
            spec = weapon.get("procedural_spec") or weapon.get("name") or "Relic Greatsword"
            hex_color = weapon.get("shader_color_hex", "#ef4444")
            glb_url = generate_weapon_glb(weapon["weapon_id"], spec, hex_color=hex_color)
            weapon["glb_url"] = f"http://localhost:8000{glb_url}"

    build_id = game_config.get("build_id", "latest")
    build_path = STORAGE_CONFIGS / f"build_{build_id}.json"
    build_path.write_text(json.dumps(game_config, indent=2))

    config_path = STORAGE_CONFIGS / "latest_game.json"
    config_path.write_text(json.dumps(game_config, indent=2))

    # Synchronously generate godot_kernel/scenes/CompiledGame.tscn
    try:
        scene_res = compile_godot_scene_from_config(game_config)
        game_config["godot_scene"] = scene_res
    except Exception as e:
        game_config["godot_scene_error"] = str(e)

    return game_config


@app.get("/api/games")
async def list_compiled_games():
    games = []
    seen_ids = set()
    for p in sorted(STORAGE_CONFIGS.glob("build_*.json"), key=lambda f: f.stat().st_mtime, reverse=True):
        try:
            data = json.loads(p.read_text())
            bid = data.get("build_id")
            if bid and bid not in seen_ids and "rooms" in data:
                seen_ids.add(bid)
                games.append(data)
        except Exception:
            continue

    # Also check latest_game.json if not in build_*.json
    latest_path = STORAGE_CONFIGS / "latest_game.json"
    if latest_path.exists():
        try:
            data = json.loads(latest_path.read_text())
            bid = data.get("build_id")
            if bid and bid not in seen_ids and "rooms" in data:
                games.insert(0, data)
        except Exception:
            pass

    return {"games": games}


@app.get("/api/games/{game_id}")
async def get_game_by_id(game_id: str):
    if game_id == "latest":
        return await get_latest_config()

    build_path = STORAGE_CONFIGS / f"build_{game_id}.json"
    if build_path.exists():
        return json.loads(build_path.read_text())

    latest_path = STORAGE_CONFIGS / "latest_game.json"
    if latest_path.exists():
        data = json.loads(latest_path.read_text())
        if data.get("build_id") == game_id:
            return data

    raise HTTPException(status_code=404, detail=f"Game '{game_id}' not found.")


@app.get("/api/game-config")
async def get_latest_config():
    config_path = STORAGE_CONFIGS / "latest_game.json"
    if config_path.exists():
        data = json.loads(config_path.read_text())
        if "build_id" in data and "rooms" in data:
            return data
    return {
        "status": "empty",
        "message": "No compiled games yet. Open the Company Studio to compile your first game."
    }


# --- Native Godot 4 Desktop Window Launcher ---
@app.post("/api/godot/launch-native")
async def launch_native_godot(payload: Optional[GodotLaunchPayload] = None):
    game_id = payload.game_id if payload else None
    game_config = None
    if game_id and game_id != "latest":
        candidate = STORAGE_CONFIGS / f"build_{game_id}.json"
        if candidate.exists():
            game_config = json.loads(candidate.read_text())

    if not game_config:
        latest_path = STORAGE_CONFIGS / "latest_game.json"
        if latest_path.exists():
            game_config = json.loads(latest_path.read_text())

    if not game_config or "rooms" not in game_config:
        raise HTTPException(status_code=404, detail="No compiled campaign available to launch in Godot 4.")

    result = launch_native_godot_window(game_config)
    return result


@app.post("/api/upload-reference-video")
async def process_reference_video(anim_id: str, file: UploadFile = File(...)):
    temp_video = Path(f"/tmp/{file.filename}")
    temp_video.write_bytes(await file.read())
    combat_metadata = await analyze_combat_video_timings(str(temp_video))
    anim_url = video_to_godot_animation(str(temp_video), anim_id)
    return {
        "anim_id": anim_id,
        "glb_animation_url": f"http://localhost:8000{anim_url}",
        "combat_metadata": combat_metadata
    }


@app.post("/api/telemetry")
async def record_telemetry(event: TelemetryEvent):
    entry = event.model_dump()
    entry["timestamp"] = datetime.now(timezone.utc).isoformat()
    TELEMETRY_LOG.append(entry)
    _save_telemetry(TELEMETRY_LOG)
    return {"status": "recorded", "total_events": len(TELEMETRY_LOG)}


@app.get("/api/analytics")
async def get_analytics():
    return {"events": TELEMETRY_LOG}


class PlaytimeSessionPayload(BaseModel):
    user_id: str
    genre_played: str
    session_duration_seconds: int


@app.get("/api/cartridges")
async def get_cartridges():
    manifest_path = REPO_ROOT / "game_templates" / "cartridge_manifest.json"
    if manifest_path.exists():
        return json.loads(manifest_path.read_text())
    return {"cartridges": []}


@app.get("/api/trends")
async def get_trends():
    return {"trends": trend_rag.list_all_trends()}


@app.post("/api/trends/add")
async def add_trend_endpoint(payload: Dict[str, Any]):
    new_t = trend_rag.add_trend(payload)
    return {"status": "added", "trend": new_t}


@app.get("/api/cohort/playtime")
async def get_cohort_playtime(demographic: Optional[str] = None):
    profiles = load_user_profiles()
    sessions = load_playtime_sessions()
    analysis = None
    if demographic:
        analysis = await analyze_demographic_playtime_winner(demographic)
    return {
        "total_users": len(profiles),
        "total_sessions": len(sessions),
        "profiles": profiles,
        "sessions": sessions,
        "demographic_query": demographic,
        "demographic_analysis": analysis
    }


@app.post("/api/cohort/session")
async def add_playtime_session(payload: PlaytimeSessionPayload):
    entry = record_playtime_session(payload.user_id, payload.genre_played, payload.session_duration_seconds)
    return {"status": "recorded", "session": entry}


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Neuro-Symbolic AI Game Compiler - Multi-Role Studio & Godot 4 Edition",
        "amd_model": amd_client.text_model,
        "zero_local_vram": True
    }


# Mount built React single-page application for production / container deployment
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend_spa")


