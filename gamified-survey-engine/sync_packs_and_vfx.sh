#!/usr/bin/env bash
set -e

mkdir -p custom_asset_packs/{characters_3d,enemies_3d,environments_3d,weapons_3d,animations_3d,effects_3d_2d,sprites_and_tiles_2d}

echo "[1/2] Scanning ~/Downloads for newly downloaded .zip, .glb, .fbx, .png asset packs..."
python3 backend/pipelines/sync_all_user_assets.py || true

echo "[2/2] Re-indexing all 3D & 2D assets into custom_asset_packs/asset_registry.json..."
blender -b -P backend/pipelines/index_custom_packs.py
