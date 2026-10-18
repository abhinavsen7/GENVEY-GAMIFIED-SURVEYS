#!/usr/bin/env bash
set -e

mkdir -p frontend/public/models/{characters,environment,weapons}
mkdir -p backend/storage/kits

echo "[1/3] Downloading Real Sculpted & Rigged 3D Characters with Multi-Clip Mocap Animations..."
# Soldier.glb (Rigged + Idle, Walk, Run mocap clips) & RobotExpressive.glb (Rigged + Attack/Punch, Jump, Dance, Death, Walking clips)
curl -sL https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb -o frontend/public/models/characters/HeroKnight.glb
curl -sL https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb -o frontend/public/models/characters/BossAutomaton.glb
curl -sL https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb -o frontend/public/models/characters/InquisitorGuard.glb

echo "[2/3] Downloading High-Detail Damaged Helmet / Armor Artifacts for PBR Showcase..."
curl -sL https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb -o frontend/public/models/weapons/RelicHelm.glb

echo "[3/3] Verifying downloaded GLB binaries..."
ls -lh frontend/public/models/characters/
ls -lh frontend/public/models/weapons/
echo "3D Asset Kits successfully fetched."
