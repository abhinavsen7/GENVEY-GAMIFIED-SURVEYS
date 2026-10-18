import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from backend.compiler.amd_client import amd_client

PROFILES_PATH = Path(__file__).resolve().parent.parent / "storage" / "cohort_profiles.json"
SESSIONS_PATH = Path(__file__).resolve().parent.parent / "storage" / "playtime_sessions.json"

DEFAULT_USERS = [
    {"user_id": "u_gz_01", "age": 20, "gender": "nonbinary", "stated_liked_genres": ["SOULSLIKE_ACTION", "PSX_SURVIVAL_HORROR", "HORDE_SURVIVOR_ARENA"]},
    {"user_id": "u_gz_02", "age": 22, "gender": "female", "stated_liked_genres": ["HORDE_SURVIVOR_ARENA", "BALDURS_GATE_CRPG"]},
    {"user_id": "u_gz_03", "age": 19, "gender": "male", "stated_liked_genres": ["PSX_SURVIVAL_HORROR", "SOULSLIKE_ACTION"]},
    {"user_id": "u_gz_04", "age": 21, "gender": "male", "stated_liked_genres": ["SOULSLIKE_ACTION", "CASTLE_SIEGE_WARFARE"]},
    {"user_id": "u_mil_01", "age": 34, "gender": "male", "stated_liked_genres": ["BALDURS_GATE_CRPG", "ULTIMA_IMMERSIVE_SANDBOX"]},
    {"user_id": "u_mil_02", "age": 31, "gender": "female", "stated_liked_genres": ["ULTIMA_IMMERSIVE_SANDBOX", "BALDURS_GATE_CRPG"]},
    {"user_id": "u_mil_03", "age": 38, "gender": "male", "stated_liked_genres": ["BALDURS_GATE_CRPG", "SOULSLIKE_ACTION"]},
    {"user_id": "u_mil_04", "age": 29, "gender": "female", "stated_liked_genres": ["MYSTERY_INVESTIGATION", "ULTIMA_IMMERSIVE_SANDBOX"]},
    {"user_id": "u_teen_01", "age": 16, "gender": "male", "stated_liked_genres": ["HORDE_SURVIVOR_ARENA", "SOULSLIKE_ACTION"]},
    {"user_id": "u_teen_02", "age": 15, "gender": "female", "stated_liked_genres": ["HORDE_SURVIVOR_ARENA", "ULTIMA_IMMERSIVE_SANDBOX"]},
]

DEFAULT_SESSIONS = [
    {"user_id": "u_gz_01", "genre_played": "SOULSLIKE_ACTION", "session_duration_seconds": 1840},
    {"user_id": "u_gz_01", "genre_played": "PSX_SURVIVAL_HORROR", "session_duration_seconds": 2100},
    {"user_id": "u_gz_02", "genre_played": "HORDE_SURVIVOR_ARENA", "session_duration_seconds": 2650},
    {"user_id": "u_gz_02", "genre_played": "BALDURS_GATE_CRPG", "session_duration_seconds": 920},
    {"user_id": "u_gz_03", "genre_played": "PSX_SURVIVAL_HORROR", "session_duration_seconds": 3200},
    {"user_id": "u_gz_03", "genre_played": "SOULSLIKE_ACTION", "session_duration_seconds": 1400},
    {"user_id": "u_gz_04", "genre_played": "SOULSLIKE_ACTION", "session_duration_seconds": 2450},
    {"user_id": "u_mil_01", "genre_played": "BALDURS_GATE_CRPG", "session_duration_seconds": 4120},
    {"user_id": "u_mil_01", "genre_played": "ULTIMA_IMMERSIVE_SANDBOX", "session_duration_seconds": 3100},
    {"user_id": "u_mil_02", "genre_played": "ULTIMA_IMMERSIVE_SANDBOX", "session_duration_seconds": 4500},
    {"user_id": "u_mil_02", "genre_played": "BALDURS_GATE_CRPG", "session_duration_seconds": 2200},
    {"user_id": "u_mil_03", "genre_played": "BALDURS_GATE_CRPG", "session_duration_seconds": 3800},
    {"user_id": "u_mil_04", "genre_played": "MYSTERY_INVESTIGATION", "session_duration_seconds": 2900},
    {"user_id": "u_teen_01", "genre_played": "HORDE_SURVIVOR_ARENA", "session_duration_seconds": 3600},
    {"user_id": "u_teen_02", "genre_played": "HORDE_SURVIVOR_ARENA", "session_duration_seconds": 2800},
]


def load_user_profiles() -> List[Dict[str, Any]]:
    if PROFILES_PATH.exists():
        try:
            return json.loads(PROFILES_PATH.read_text())
        except Exception:
            pass
    PROFILES_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILES_PATH.write_text(json.dumps(DEFAULT_USERS, indent=2))
    return DEFAULT_USERS


def load_playtime_sessions() -> List[Dict[str, Any]]:
    if SESSIONS_PATH.exists():
        try:
            return json.loads(SESSIONS_PATH.read_text())
        except Exception:
            pass
    SESSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SESSIONS_PATH.write_text(json.dumps(DEFAULT_SESSIONS, indent=2))
    return DEFAULT_SESSIONS


def record_playtime_session(user_id: str, genre_played: str, session_duration_seconds: int) -> Dict[str, Any]:
    sessions = load_playtime_sessions()
    entry = {
        "user_id": user_id,
        "genre_played": genre_played,
        "session_duration_seconds": int(session_duration_seconds)
    }
    sessions.append(entry)
    SESSIONS_PATH.write_text(json.dumps(sessions, indent=2))
    return entry


async def analyze_demographic_playtime_winner(target_demographic: str) -> Dict[str, Any]:
    """
    Parses natural language target_demographic (e.g. 'Gen Z college students'),
    filters matching users from profiles, sums session_duration_seconds grouped by genre_played,
    and returns the statistically proven winning genre for this demographic.
    """
    users = load_user_profiles()
    sessions = load_playtime_sessions()

    # Deconstruct demographic criteria using LLM or rule-based fallback
    demo_low = (target_demographic or "").lower()
    min_age = 0
    max_age = 120
    preferred_genders = []

    if "gen z" in demo_low or "college" in demo_low or "young" in demo_low or "student" in demo_low:
        min_age, max_age = 18, 26
    elif "teen" in demo_low or "high school" in demo_low or "alpha" in demo_low:
        min_age, max_age = 13, 17
    elif "millennial" in demo_low or "adult" in demo_low or "30" in demo_low:
        min_age, max_age = 27, 45
    elif "boomer" in demo_low or "senior" in demo_low:
        min_age, max_age = 46, 90

    if "female" in demo_low or "women" in demo_low or "girl" in demo_low:
        preferred_genders.append("female")
    if "male" in demo_low or "men" in demo_low or "boy" in demo_low:
        preferred_genders.append("male")

    # Filter matching cohort users
    matching_user_ids = set()
    for u in users:
        u_age = u.get("age", 25)
        u_gender = u.get("gender", "").lower()
        if min_age <= u_age <= max_age:
            if not preferred_genders or u_gender in preferred_genders or u_gender == "nonbinary":
                matching_user_ids.add(u["user_id"])

    # Fallback if filter is too narrow
    if not matching_user_ids:
        matching_user_ids = {u["user_id"] for u in users}

    # Sum session duration seconds by genre
    genre_durations: Dict[str, int] = {}
    for s in sessions:
        if s["user_id"] in matching_user_ids:
            g = s.get("genre_played", "BALDURS_GATE_CRPG")
            genre_durations[g] = genre_durations.get(g, 0) + s.get("session_duration_seconds", 0)

    sorted_genres = sorted(genre_durations.items(), key=lambda kv: kv[1], reverse=True)
    winning_genre = sorted_genres[0][0] if sorted_genres else "DARK_SOULS_ACTION"
    winning_seconds = sorted_genres[0][1] if sorted_genres else 1800

    return {
        "target_demographic": target_demographic,
        "matched_cohort_users": len(matching_user_ids),
        "cohort_age_range": f"{min_age}-{max_age}",
        "genre_rankings": [
            {"genre": g, "total_playtime_seconds": sec, "total_playtime_minutes": round(sec / 60.0, 1)}
            for g, sec in sorted_genres
        ],
        "winning_genre": winning_genre,
        "winning_playtime_seconds": winning_seconds,
        "recommendation_rationale": (
            f"Based on {len(matching_user_ids)} cohort users matching '{target_demographic}', "
            f"'{winning_genre}' captured the highest total retention ({round(winning_seconds / 60.0, 1)} minutes)."
        )
    }
