#!/usr/bin/env bash
set -e

mkdir -p frontend/public/kaykit
cd frontend/public/kaykit

echo "[1/4] Cloning KayKit Dungeon Remastered (200+ Modular Dungeon GLTF/GLB Pieces)..."
if [ ! -d "dungeon" ]; then
    git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0.git dungeon
fi

echo "[2/4] Cloning KayKit Adventurers Pack (Knight, Barbarian, Mage, Rogue + 90 Combat Animations)..."
if [ ! -d "adventurers" ]; then
    git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0.git adventurers
fi

echo "[3/4] Cloning KayKit Skeletons Pack (Skeleton Warrior, Mage, Minion, Rogue + Combat/Death Animations)..."
if [ ! -d "skeletons" ]; then
    git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0.git skeletons
fi

cd ../../..

echo "[4/4] Building KayKit Asset Manifest (frontend/public/kaykit/manifest.json)..."
python3 - << 'EOF'
import json
from pathlib import Path

root = Path("frontend/public/kaykit")
manifest = {"dungeon": [], "adventurers": [], "skeletons": [], "animations": []}

for ext in ("*.gltf", "*.glb"):
    for p in sorted(root.rglob(ext)):
        rel = "/" + str(p.relative_to(Path("frontend/public")))
        low = p.name.lower()
        if "anim" in low or "rig" in str(p).lower():
            manifest["animations"].append({"name": p.stem, "url": rel})
        if "dungeon" in rel:
            manifest["dungeon"].append({"name": p.stem, "url": rel})
        elif "adventurers" in rel:
            manifest["adventurers"].append({"name": p.stem, "url": rel})
        elif "skeletons" in rel:
            manifest["skeletons"].append({"name": p.stem, "url": rel})

out_file = root / "manifest.json"
out_file.write_text(json.dumps(manifest, indent=2))
print(f"Manifest created: {len(manifest['dungeon'])} dungeon meshes, {len(manifest['adventurers'])} adventurer assets, {len(manifest['skeletons'])} skeleton enemy assets, {len(manifest['animations'])} animation packs.")
EOF
