import subprocess
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_GLB = BASE_DIR / "storage" / "generated_glb"
BLENDER_FORGE_SCRIPT = BASE_DIR / "pipelines" / "blender_scripts" / "procedural_weapon_forge.py"

def generate_weapon_glb(weapon_id: str, prompt_or_spec: any = None, hex_color: str = "#ef4444") -> str:
    STORAGE_GLB.mkdir(parents=True, exist_ok=True)
    final_path = STORAGE_GLB / f"{weapon_id}.glb"

    if isinstance(prompt_or_spec, dict):
        spec = prompt_or_spec
    elif isinstance(prompt_or_spec, str) and prompt_or_spec.startswith("{"):
        try:
            spec = json.loads(prompt_or_spec)
        except Exception:
            spec = {"archetype": "GREATSWORD", "blade_length": 1.15, "blade_width": 0.12}
    else:
        p_lower = str(prompt_or_spec or "").lower()
        if "rapier" in p_lower:
            archetype = "RAPIER"
        elif "hammer" in p_lower:
            archetype = "WARHAMMER"
        elif "scythe" in p_lower:
            archetype = "SCYTHE"
        else:
            archetype = "GREATSWORD"
        spec = {
            "archetype": archetype,
            "blade_length": 1.2 if archetype == "GREATSWORD" else 1.05,
            "blade_width": 0.14 if archetype == "GREATSWORD" else 0.05,
            "shader_color_hex": hex_color
        }

    if "shader_color_hex" not in spec:
        spec["shader_color_hex"] = hex_color

    subprocess.run([
        "blender", "-b", "-P", str(BLENDER_FORGE_SCRIPT),
        "--", json.dumps(spec), str(final_path)
    ], check=True, stdout=subprocess.DEVNULL)

    # Mirror to frontend/public/models/weapons/ for instant static loading
    frontend_dest = BASE_DIR.parent / "frontend" / "public" / "models" / "weapons" / f"{weapon_id}.glb"
    try:
        frontend_dest.parent.mkdir(parents=True, exist_ok=True)
        frontend_dest.write_bytes(final_path.read_bytes())
    except Exception:
        pass

    return f"/assets/glb/{weapon_id}.glb"
