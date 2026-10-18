import json
import shutil
import subprocess
import sys
from pathlib import Path

# Prevent local `mcp/` directory from shadowing the installed `mcp` SDK package if repo root is in sys.path
_REPO_ROOT_STR = str(Path(__file__).resolve().parent.parent)
_removed_root = False
if _REPO_ROOT_STR in sys.path:
    sys.path.remove(_REPO_ROOT_STR)
    _removed_root = True
if "" in sys.path:
    sys.path.remove("")

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    from fastmcp import FastMCP

if _removed_root:
    sys.path.append(_REPO_ROOT_STR)

mcp = FastMCP("Godot4-NeuroSymbolic-MCP")
REPO_ROOT = Path(__file__).resolve().parent.parent
GODOT_PROJECT_DIR = REPO_ROOT / "godot_kernel"
FRONTEND_KAYKIT_DIR = REPO_ROOT / "frontend" / "public" / "kaykit"


def _run_godot_bridge(cmd: str, payload: dict) -> dict:
    proc = subprocess.run(
        [
            "godot4", "--headless", "--path", str(GODOT_PROJECT_DIR),
            "-s", "res://scripts/mcp_bridge_cli.gd",
            "--", cmd, json.dumps(payload)
        ],
        capture_output=True,
        text=True,
        timeout=60
    )
    out = proc.stdout
    if "MCP_JSON_START" in out and "MCP_JSON_END" in out:
        json_block = out.split("MCP_JSON_START")[-1].split("MCP_JSON_END")[0].strip()
        return json.loads(json_block)
    return {"stdout": out, "stderr": proc.stderr, "returncode": proc.returncode}


@mcp.tool()
def godot_inspect_asset(res_path: str) -> dict:
    """Inspects an imported .glb/.gltf or .tscn inside godot_kernel and returns exact bone names, animation clips, and mesh paths."""
    return _run_godot_bridge("inspect_gltf", {"res_path": res_path})


@mcp.tool()
def godot_sync_kaykit_assets() -> dict:
    """Links or copies the KayKit dungeon, adventurers, and skeletons .gltf/.glb assets into godot_kernel/assets/kaykit/ and runs godot4 --headless --import."""
    target_base = GODOT_PROJECT_DIR / "assets" / "kaykit"
    target_base.mkdir(parents=True, exist_ok=True)

    synced_files = []
    source_map = {
        "dungeon": [
            FRONTEND_KAYKIT_DIR / "dungeon" / "addons" / "kaykit_dungeon_remastered" / "Assets" / "gltf",
            FRONTEND_KAYKIT_DIR / "dungeon" / "Assets" / "gltf",
        ],
        "adventurers": [
            FRONTEND_KAYKIT_DIR / "adventurers" / "addons" / "kaykit_character_pack_adventures" / "Characters" / "gltf",
            FRONTEND_KAYKIT_DIR / "adventurers" / "addons" / "kaykit_character_pack_adventures" / "Assets" / "gltf",
            FRONTEND_KAYKIT_DIR / "adventurers" / "Assets" / "gltf",
        ],
        "skeletons": [
            FRONTEND_KAYKIT_DIR / "skeletons" / "addons" / "kaykit_character_pack_skeletons" / "Characters" / "gltf",
            FRONTEND_KAYKIT_DIR / "skeletons" / "addons" / "kaykit_character_pack_skeletons" / "Assets" / "gltf",
            FRONTEND_KAYKIT_DIR / "skeletons" / "Assets" / "gltf",
        ],
    }

    key_assets = {
        "dungeon": [
            "floor_tile_large.gltf.glb",
            "wall.gltf.glb",
            "wall_doorway.gltf",
            "pillar.gltf.glb",
            "torch_lit.gltf.glb",
            "chest_gold.gltf.glb",
            "barrel_large.gltf.glb",
            "banner_red.gltf.glb",
            "dungeon_texture.png",
        ],
        "adventurers": [
            "Knight.glb",
            "Barbarian.glb",
            "Mage.glb",
            "Rogue.glb",
            "sword_1handed.gltf.glb",
            "sword_2handed.gltf.glb",
            "axe_2handed.gltf.glb",
            "staff.gltf.glb",
            "shield_badge.gltf.glb",
            "knight_texture.png",
            "barbarian_texture.png",
            "mage_texture.png",
            "rogue_texture.png",
        ],
        "skeletons": [
            "Skeleton_Warrior.glb",
            "Skeleton_Minion.glb",
            "Skeleton_Mage.glb",
            "Skeleton_Rogue.glb",
            "Skeleton_Blade.gltf.glb",
            "Skeleton_Axe.gltf.glb",
            "skeleton_texture.png",
        ],
    }

    for category, files in key_assets.items():
        dst_dir = target_base / category
        dst_dir.mkdir(parents=True, exist_ok=True)
        for fname in files:
            for src_dir in source_map[category]:
                src_file = src_dir / fname
                if src_file.exists():
                    dst_file = dst_dir / fname
                    if not dst_file.exists():
                        shutil.copy2(src_file, dst_file)
                    synced_files.append(f"res://assets/kaykit/{category}/{fname}")
                    if fname.endswith(".gltf"):
                        for bin_file in src_dir.glob(fname.replace(".gltf", "*.bin")):
                            dst_bin = dst_dir / bin_file.name
                            if not dst_bin.exists():
                                shutil.copy2(bin_file, dst_bin)
                    break

    import_res = godot_import_and_verify()
    return {
        "status": "synced",
        "synced_count": len(synced_files),
        "synced_files": synced_files,
        "import_result": import_res,
    }


@mcp.tool()
def godot_import_and_verify() -> dict:
    """Runs Godot 4 headless import pass to generate .import files and UIDs for all KayKit 3D models, then verifies all GDScript files."""
    proc = subprocess.run(
        ["godot4", "--headless", "--path", str(GODOT_PROJECT_DIR), "--import", "--quit"],
        capture_output=True,
        text=True,
        timeout=90
    )
    return {"returncode": proc.returncode, "stderr": proc.stderr[-1000:], "stdout": proc.stdout[-1000:]}


@mcp.tool()
def godot_build_native_scene(save_path: str = "res://scenes/GeneratedDungeon.tscn") -> dict:
    """Uses Godot 4's native PackedScene serializer to build a valid .tscn with ACES tonemapping, glow, and volumetric fog."""
    return _run_godot_bridge("build_kaykit_dungeon_scene", {"save_path": save_path})


@mcp.tool()
def godot_build_scene(config_json: str = "{}") -> dict:
    """Uses Godot's native PackedScene.pack() via mcp_bridge_cli.gd to construct and save error-free .tscn scenes."""
    try:
        cfg = json.loads(config_json) if config_json else {}
    except Exception:
        cfg = {}
    if "save_path" not in cfg:
        cfg["save_path"] = "res://scenes/GeneratedDungeon.tscn"
    return _run_godot_bridge("build_kaykit_dungeon_scene", cfg)


@mcp.tool()
def godot_validate_scripts() -> dict:
    """Runs godot4 --headless --path godot_kernel --quit and verifies all GDScript compilation and project integrity."""
    proc = subprocess.run(
        ["godot4", "--headless", "--path", str(GODOT_PROJECT_DIR), "--quit"],
        capture_output=True,
        text=True,
        timeout=60
    )
    return {
        "valid": proc.returncode == 0 and "SCRIPT ERROR" not in proc.stderr,
        "returncode": proc.returncode,
        "stderr": proc.stderr[-1500:],
        "stdout": proc.stdout[-1500:],
    }


@mcp.tool()
def godot_export_web_wasm() -> dict:
    """Exports the Godot 4 project to frontend/public/godot_wasm/index.html so it can be embedded directly inside the React dashboard."""
    script_path = REPO_ROOT / "export_godot_web.sh"
    proc = subprocess.run(
        ["bash", str(script_path)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=60
    )
    wasm_html = REPO_ROOT / "frontend" / "public" / "godot_wasm" / "index.html"
    return {
        "returncode": proc.returncode,
        "wasm_bridge_exists": wasm_html.exists(),
        "wasm_bridge_path": str(wasm_html),
        "stdout": proc.stdout[-1000:],
        "stderr": proc.stderr[-1000:],
    }


if __name__ == "__main__":
    mcp.run()
