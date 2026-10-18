#!/usr/bin/env bash
set -e

REPO_ROOT="/home/me/Videos/AMDHACKTHREE/gamified-survey-engine"
PACKS_DIR="$REPO_ROOT/custom_asset_packs"

mkdir -p "$PACKS_DIR"/{characters,environments,weapons_and_items,animations,effects}
ln -sfn "$PACKS_DIR" "/home/me/Videos/AMDHACKTHREE/custom_asset_packs"

python3 - << 'PYEOF'
import shutil
import zipfile
from pathlib import Path

home_dl = Path.home() / "Downloads"
repo_root = Path("/home/me/Videos/AMDHACKTHREE/gamified-survey-engine")
packs_dir = repo_root / "custom_asset_packs"

# 1. Modular Character Outfits - Fantasy[Standard].zip
z1 = home_dl / "Modular Character Outfits - Fantasy[Standard].zip"
if z1.exists():
    print("[1/5] Extracting Modular Character Outfits - Fantasy[Standard].zip...")
    outfits_dst = packs_dir / "characters" / "fantasy_outfits"
    outfits_dst.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(z1, "r") as zf:
        for member in zf.namelist():
            if "Exports/glTF (Godot-Unreal)/Outfits/" in member and not member.endswith("/"):
                fname = Path(member).name
                with zf.open(member) as src, open(outfits_dst / fname, "wb") as dst:
                    shutil.copyfileobj(src, dst)

# 2. Universal Animation Library 1 & 2
for zname in ["Universal Animation Library[Standard].zip", "Universal Animation Library 2[Standard].zip"]:
    zp = home_dl / zname
    if zp.exists():
        print(f"[2/5] Extracting {zname}...")
        with zipfile.ZipFile(zp, "r") as zf:
            for member in zf.namelist():
                if member.endswith(".glb"):
                    fname = Path(member).name
                    if "Mannequin" in fname:
                        target = packs_dir / "characters" / fname
                    else:
                        target = packs_dir / "animations" / fname
                    with zf.open(member) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)

# 3. ModularCastle_AssetPack-Ver2.zip
z3 = home_dl / "ModularCastle_AssetPack-Ver2.zip"
if z3.exists():
    print("[3/5] Extracting ModularCastle_AssetPack-Ver2.zip...")
    with zipfile.ZipFile(z3, "r") as zf:
        zf.extractall(packs_dir / "environments")

# 4. BattleFXFree.zip & SourceCode.zip
for zname in ["BattleFXFree.zip", "SourceCode.zip"]:
    zp = home_dl / zname
    if zp.exists():
        print(f"[4/5] Extracting {zname}...")
        with zipfile.ZipFile(zp, "r") as zf:
            zf.extractall(packs_dir / "effects")

print("Archive extraction complete.")
PYEOF

echo "[5/5] Organizing RPG Weapons, Skeleton Enemies & Adventurers into custom_asset_packs/..."
if [ -d "$REPO_ROOT/frontend/public/kaykit" ]; then
    cp -f "$REPO_ROOT/frontend/public/kaykit/adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/"*.glb "$PACKS_DIR/characters/" 2>/dev/null || true
    cp -f "$REPO_ROOT/frontend/public/kaykit/adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/"*.png "$PACKS_DIR/characters/" 2>/dev/null || true
    cp -f "$REPO_ROOT/frontend/public/kaykit/skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/"*.glb "$PACKS_DIR/characters/" 2>/dev/null || true
    cp -f "$REPO_ROOT/frontend/public/kaykit/skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/"*.png "$PACKS_DIR/characters/" 2>/dev/null || true
    cp -f "$REPO_ROOT/frontend/public/kaykit/adventurers/addons/kaykit_character_pack_adventures/Assets/gltf/"*.glb "$PACKS_DIR/weapons_and_items/" 2>/dev/null || true
    cp -f "$REPO_ROOT/frontend/public/kaykit/skeletons/addons/kaykit_character_pack_skeletons/Assets/gltf/"*.glb "$PACKS_DIR/weapons_and_items/" 2>/dev/null || true
    cp -f "$REPO_ROOT/frontend/public/kaykit/dungeon/addons/kaykit_dungeon_remastered/Assets/gltf/chest_gold.glb" "$PACKS_DIR/weapons_and_items/" 2>/dev/null || true
fi

ln -sfn "$PACKS_DIR" "$REPO_ROOT/frontend/public/custom_assets"
ln -sfn "$PACKS_DIR" "$REPO_ROOT/frontend/public/custom_asset_packs"
ln -sfn "$PACKS_DIR" "$REPO_ROOT/godot_kernel/assets/custom_asset_packs"

echo "Successfully ingested all user packs into $PACKS_DIR!"
