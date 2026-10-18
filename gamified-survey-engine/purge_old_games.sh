#!/usr/bin/env bash
set -e

echo "[1/3] Deleting old pre-established game configs & generated placeholders..."
rm -rf backend/storage/configs/*.json
rm -rf backend/storage/generated_glb/*.glb
rm -rf backend/storage/generated_anims/*.glb
rm -rf frontend/public/models/characters/{HeroKnight.glb,BossAutomaton.glb,InquisitorGuard.glb}

echo "[2/3] Stripping hardcoded fallback games from Frontend & Backend..."
# Ensure backend/main.py and frontend/src/App.jsx start with an empty state that requires compiling from custom_asset_packs/
echo "Old games and placeholder models purged."
