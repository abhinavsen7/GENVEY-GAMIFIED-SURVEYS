#!/usr/bin/env bash
set -e

mkdir -p backend/storage/{generated_glb,generated_anims,configs}
mkdir -p godot_kernel/{assets/rig,assets/modular_kit,scripts,shaders,scenes}
mkdir -p external_models

echo "[1/3] Verifying Headless Blender & Godot 4 CLI..."
export PATH="$HOME/.local/bin:$PATH"

if ! command -v godot4 &> /dev/null; then
    if [ -f "$HOME/.local/bin/godot" ]; then
        ln -sf "$HOME/.local/bin/godot" "$HOME/.local/bin/godot4"
    else
        wget -q https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip -O /tmp/godot.zip
        unzip -o /tmp/godot.zip -d /tmp/
        mkdir -p "$HOME/.local/bin"
        mv /tmp/Godot_v4.3-stable_linux.x86_64 "$HOME/.local/bin/godot4"
        chmod +x "$HOME/.local/bin/godot4"
        rm -f /tmp/godot.zip
    fi
fi

echo "[2/3] Setting up Python Virtual Environment (Zero GPU VRAM, AMD Token Factory)..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r backend/requirements.txt

echo "[3/3] Setting up Frontend..."
if [ -d "frontend" ]; then
    cd frontend && npm install && cd ..
fi

echo "Zero-GPU AMD Token Factory Environment setup complete."
