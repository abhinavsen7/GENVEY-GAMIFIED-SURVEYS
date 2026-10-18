#!/usr/bin/env python3
"""
Incremental 2D & 3D Asset Scanner & Headless Blender Indexer
Scans ~/Downloads and workspace directories for new 3D/2D asset packs (.zip, .rar, .7z, .glb, .gltf, .fbx, .obj, .png, .gdshader),
merges them non-destructively into custom_asset_packs/ alongside existing packs, converts new .fbx/.obj files to .glb via Headless Blender,
and updates custom_asset_packs/asset_registry.json with full 3D + 2D metadata.
"""
import json
import os
import re
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path
from typing import Dict, List, Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PACKS_ROOT = REPO_ROOT / "custom_asset_packs"
DOWNLOADS_DIR = Path.home() / "Downloads"
REGISTRY_PATH = PACKS_ROOT / "asset_registry.json"

CATEGORY_DIRS = [
    "characters_3d",
    "enemies_3d",
    "environments_3d",
    "weapons_3d",
    "animations_3d",
    "effects_3d_2d",
    "sprites_and_tiles_2d",
]

# Priority FBX characters, monsters, weapons, and dungeon props to auto-convert to .glb via Headless Blender
PRIORITY_FBX_MODELS = {
    # Characters_psx
    "Character_01.fbx", "Character_05.fbx", "Character_17_Police.fbx", "Character_23_Firefighter.fbx", "Character_25_Doctor.fbx",
    "Character_02.fbx", "Character_06.fbx", "Character_12_Nurse.fbx", "Character_18_Police.fbx",
    "Character_13_Killer.fbx", "Character_14_Monster.fbx", "Character_15_Mask.fbx", "Character_16_Clown.fbx",
    "Character_26_Zombie.fbx", "Character_27_Zombie.fbx",
    # HD Survivor
    "Survivor WITH BIKE (2).fbx", "Survivor 1.fbx",
    # Quaternius Animated Monsters & RPG Characters
    "Bat.fbx", "Dragon.fbx", "Slime.fbx",
    "Cleric.fbx", "Monk.fbx", "Ranger.fbx", "Rogue.fbx", "Warrior.fbx", "Wizard.fbx",
    "Cleric_Staff.fbx", "Ranger_Bow.fbx", "Rogue_Dagger.fbx", "Warrior_Sword.fbx", "Wizard_Staff.fbx",
    # Quaternius Medieval Weapons & Dungeon
    "Claymore.fbx", "Scythe.fbx", "Axe_Double.fbx", "Hammer_Double.fbx", "Bow_Evil.fbx", "Shield_Celtic_Golden.fbx",
    "Arch_bars.fbx", "Arch_Door.fbx", "Chest_Gold.fbx", "Bag_Coins.fbx",
}

PRIORITY_CASTLE_FBX = {
    "Floor_1x1.fbx", "Floor_2x1.fbx", "Floor_2x2.fbx",
    "Ramp_Long_1.fbx", "Ramp_Steep_1.fbx",
    "Wall_Mid_x1.fbx", "Wall_Mid_x2.fbx", "Wall_Mid_x4.fbx",
    "Wall_Mid_x2_Tall.fbx", "Wall_Mid_x4_Tall.fbx",
    "Wall_Bottom_x2.fbx", "Wall_Top_x2.fbx", "Wall_Corner_Mid.fbx",
    "Arch_Segment_Full.fbx", "Arch_Segment_Full_x2.fbx", "Arch_Decor_Wide_x2.fbx",
    "Ceiling_2x2.fbx", "Ceiling_Arch_Wide_x2.fbx", "Roof_x2.fbx",
    "Banner_Wall.fbx", "Banner_Wall_Worn_1.fbx", "Barrel.fbx",
    "Crate.fbx", "Crate_Long.fbx", "Table.fbx", "Carpet_Segment.fbx",
    "Floating_Platform_Crystal.fbx", "Spear_Blade.fbx", "Swinging_Blade.fbx",
    "Torch.fbx", "Wall_Holder_Torch.fbx", "Post_Stand_Lamp.fbx", "Lamp.fbx",
    "suzanne.obj"
}


def ensure_directories_and_preserve_existing():
    """Creates categorized subdirectories and syncs existing packs without deleting anything."""
    PACKS_ROOT.mkdir(parents=True, exist_ok=True)
    for d in CATEGORY_DIRS:
        (PACKS_ROOT / d).mkdir(parents=True, exist_ok=True)

    legacy_mappings = [
        ("characters", "characters_3d"),
        ("environments", "environments_3d"),
        ("weapons_and_items", "weapons_3d"),
        ("animations", "animations_3d"),
        ("effects", "effects_3d_2d"),
    ]
    for old_name, new_name in legacy_mappings:
        old_dir = PACKS_ROOT / old_name
        new_dir = PACKS_ROOT / new_name
        if old_dir.exists() and old_dir.is_dir():
            for item in old_dir.iterdir():
                dest = new_dir / item.name
                if not dest.exists():
                    if item.is_dir():
                        shutil.copytree(item, dest, dirs_exist_ok=True)
                    else:
                        shutil.copy2(item, dest)

    chars_3d = PACKS_ROOT / "characters_3d"
    enemies_3d = PACKS_ROOT / "enemies_3d"
    for skel_file in chars_3d.glob("Skeleton*"):
        dest = enemies_3d / skel_file.name
        if not dest.exists():
            shutil.copy2(skel_file, dest)
    skel_tex = chars_3d / "skeleton_texture.png"
    if skel_tex.exists() and not (enemies_3d / "skeleton_texture.png").exists():
        shutil.copy2(skel_tex, enemies_3d / "skeleton_texture.png")


def ingest_downloads() -> List[str]:
    """Scans ~/Downloads for new 2D/3D packs (including Quaternius, Kenney, KayKit, FLARE, 0x72, Tiny Swords, PSX) and extracts them into custom_asset_packs/."""
    ingested_packs = []
    if not DOWNLOADS_DIR.exists():
        return ingested_packs

    # 1. (DEMO) Lords Of Pain - Old School Isometric Assets.zip
    lop_zip = DOWNLOADS_DIR / "(DEMO) Lords Of Pain - Old School Isometric Assets.zip"
    lop_dest = PACKS_ROOT / "sprites_and_tiles_2d" / "LordsOfPain_Isometric"
    if lop_zip.exists() and not lop_dest.exists():
        lop_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(lop_zip, "r") as z:
            z.extractall(lop_dest)
        ingested_packs.append(lop_zip.name)

    # 2. FREE Character HD Survivor W Bike.zip
    surv_zip = DOWNLOADS_DIR / "FREE Character HD Survivor W Bike.zip"
    surv_dest = PACKS_ROOT / "sprites_and_tiles_2d" / "HD_Survivor_2D"
    if surv_zip.exists() and not surv_dest.exists():
        surv_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(surv_zip, "r") as z:
            z.extractall(surv_dest)
        ingested_packs.append(surv_zip.name)

    # 3. KayKit_Dungeon_Pack_1.1_FREE.zip
    kaykit_zip = DOWNLOADS_DIR / "KayKit_Dungeon_Pack_1.1_FREE.zip"
    kaykit_dest = PACKS_ROOT / "environments_3d" / "KayKit_Dungeon_1.1"
    if kaykit_zip.exists() and not kaykit_dest.exists():
        kaykit_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(kaykit_zip, "r") as z:
            for member in z.namelist():
                if "/Assets/gltf/" in member or "/Assets/textures/" in member:
                    z.extract(member, kaykit_dest)
        ingested_packs.append(kaykit_zip.name)

    # 4. KayKit_Halloween_Crypts_1.0.zip (Spooktober Crypts)
    kk_hal_zip = DOWNLOADS_DIR / "KayKit_Halloween_Crypts_1.0.zip"
    kk_hal_dest = PACKS_ROOT / "environments_3d" / "KayKit_Halloween_Crypts"
    if kk_hal_zip.exists() and not kk_hal_dest.exists():
        kk_hal_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(kk_hal_zip, "r") as z:
            for member in z.namelist():
                if "/Assets/gltf/" in member or "/Assets/textures/" in member:
                    z.extract(member, kk_hal_dest)
        ingested_packs.append(kk_hal_zip.name)

    # 5. Kenney_Particle_Pack.zip -> effects_3d_2d/Kenney_Particle_Pack
    kenney_fx_zip = DOWNLOADS_DIR / "Kenney_Particle_Pack.zip"
    kenney_fx_dest = PACKS_ROOT / "effects_3d_2d" / "Kenney_Particle_Pack"
    if kenney_fx_zip.exists() and not kenney_fx_dest.exists():
        kenney_fx_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(kenney_fx_zip, "r") as z:
            for member in z.namelist():
                if member.startswith("PNG (Transparent)/") and member.lower().endswith(".png"):
                    fname = Path(member).name
                    (kenney_fx_dest / fname).write_bytes(z.read(member))
        ingested_packs.append(kenney_fx_zip.name)

    # 6. Kenney_Graveyard_Kit.zip -> environments_3d/Kenney_Graveyard_Kit + enemies_3d/Kenney_Graveyard_Monsters
    kenney_grave_zip = DOWNLOADS_DIR / "Kenney_Graveyard_Kit.zip"
    kenney_grave_dest = PACKS_ROOT / "environments_3d" / "Kenney_Graveyard_Kit"
    kenney_grave_enemies = PACKS_ROOT / "enemies_3d" / "Kenney_Graveyard_Monsters"
    if kenney_grave_zip.exists() and not kenney_grave_dest.exists():
        kenney_grave_dest.mkdir(parents=True, exist_ok=True)
        kenney_grave_enemies.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(kenney_grave_zip, "r") as z:
            for member in z.namelist():
                if ("Models/GLB format/" in member and member.lower().endswith(".glb")) or ("Textures/" in member and member.lower().endswith(".png")):
                    z.extract(member, kenney_grave_dest)
                    if "character-" in member.lower() and member.lower().endswith(".glb"):
                        (kenney_grave_enemies / Path(member).name).write_bytes(z.read(member))
        ingested_packs.append(kenney_grave_zip.name)

    # 7. Kenney_Castle_Kit.zip -> environments_3d/Kenney_Castle_Kit
    kenney_castle_zip = DOWNLOADS_DIR / "Kenney_Castle_Kit.zip"
    kenney_castle_dest = PACKS_ROOT / "environments_3d" / "Kenney_Castle_Kit"
    if kenney_castle_zip.exists() and not kenney_castle_dest.exists():
        kenney_castle_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(kenney_castle_zip, "r") as z:
            for member in z.namelist():
                if ("Models/GLB format/" in member and member.lower().endswith(".glb")) or ("Textures/" in member and member.lower().endswith(".png")):
                    z.extract(member, kenney_castle_dest)
        ingested_packs.append(kenney_castle_zip.name)

    # 8. Quaternius packs (Monsters, RPG Characters, Modular Dungeon, Medieval Weapons)
    quat_mappings = [
        ("Quaternius_Animated_Monsters.zip", PACKS_ROOT / "enemies_3d" / "Quaternius_Monsters"),
        ("Quaternius_RPG_Characters.zip", PACKS_ROOT / "characters_3d" / "Quaternius_RPG_Heroes"),
        ("Quaternius_Modular_Dungeon.zip", PACKS_ROOT / "environments_3d" / "Quaternius_Modular_Dungeon"),
        ("Quaternius_Medieval_Weapons.zip", PACKS_ROOT / "weapons_3d" / "Quaternius_Medieval_Weapons"),
    ]
    for zname, qdest in quat_mappings:
        qzip = DOWNLOADS_DIR / zname
        if qzip.exists() and not qdest.exists():
            qdest.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(qzip, "r") as z:
                for member in z.namelist():
                    if member.lower().endswith((".fbx", ".png", ".jpg")):
                        z.extract(member, qdest)
            ingested_packs.append(zname)

    # 9. 2D CC0 Packs: FLARE_Dark_Ruins_Isometric.zip, 0x72_DungeonTileset_II.zip, PixelFrog_Tiny_Swords.zip
    flare_zip = DOWNLOADS_DIR / "FLARE_Dark_Ruins_Isometric.zip"
    flare_dest = PACKS_ROOT / "sprites_and_tiles_2d" / "FLARE_Dark_Ruins_Isometric"
    if flare_zip.exists() and not flare_dest.exists():
        flare_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(flare_zip, "r") as z:
            z.extractall(flare_dest)
        ingested_packs.append(flare_zip.name)

    d72_zip = DOWNLOADS_DIR / "0x72_DungeonTileset_II.zip"
    d72_dest = PACKS_ROOT / "sprites_and_tiles_2d" / "0x72_DungeonTileset_II"
    if d72_zip.exists() and not d72_dest.exists():
        d72_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(d72_zip, "r") as z:
            for member in z.namelist():
                if member.lower().endswith(".png") and ("tiles" in member.lower() or "0x72" in member.lower() or "dungeon" in member.lower() or "assets" in member.lower() or "sprites" in member.lower()):
                    fname = Path(member).name
                    (d72_dest / fname).write_bytes(z.read(member))
        ingested_packs.append(d72_zip.name)

    tiny_zip = DOWNLOADS_DIR / "PixelFrog_Tiny_Swords.zip"
    tiny_dest = PACKS_ROOT / "sprites_and_tiles_2d" / "PixelFrog_Tiny_Swords"
    if tiny_zip.exists() and not tiny_dest.exists():
        tiny_dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(tiny_zip, "r") as z:
            for member in z.namelist():
                if member.lower().endswith(".png") and "tiny swords" in member.lower():
                    rel_sub = member.split("Tiny Swords/", 1)[-1]
                    out_p = tiny_dest / rel_sub
                    out_p.parent.mkdir(parents=True, exist_ok=True)
                    out_p.write_bytes(z.read(member))
        ingested_packs.append(tiny_zip.name)

    # 10. Characters_psx.rar -> characters_3d/Characters_PSX and enemies_3d/Characters_PSX_Killers
    psx_rar = DOWNLOADS_DIR / "Characters_psx.rar"
    psx_char_dest = PACKS_ROOT / "characters_3d" / "Characters_PSX"
    psx_enemy_dest = PACKS_ROOT / "enemies_3d" / "Characters_PSX_Killers"
    if psx_rar.exists() and not psx_char_dest.exists():
        psx_char_dest.mkdir(parents=True, exist_ok=True)
        psx_enemy_dest.mkdir(parents=True, exist_ok=True)
        bsdtar_bin = shutil.which("bsdtar") or "/home/me/miniconda3/bin/bsdtar"
        sevenz_bin = shutil.which("7z") or "/home/me/.local/bin/7z"
        tmp_extract = Path("/tmp/_agy_tmp_psx")
        tmp_extract.mkdir(parents=True, exist_ok=True)
        if Path(bsdtar_bin).exists():
            subprocess.run([bsdtar_bin, "-xf", str(psx_rar), "-C", str(tmp_extract)], check=False)
        elif Path(sevenz_bin).exists():
            subprocess.run([sevenz_bin, "x", "-y", f"-o{tmp_extract}", str(psx_rar)], check=False)

        extracted_root = tmp_extract / "Characters_psx"
        if extracted_root.exists():
            tex_dir = extracted_root / "Textures"
            if tex_dir.exists():
                shutil.copytree(tex_dir, psx_char_dest / "Textures", dirs_exist_ok=True)
                shutil.copytree(tex_dir, psx_enemy_dest / "Textures", dirs_exist_ok=True)
            for sub in ("Male", "Female"):
                src_sub = extracted_root / "Models" / sub
                if src_sub.exists():
                    shutil.copytree(src_sub, psx_char_dest / sub, dirs_exist_ok=True)
            killers_sub = extracted_root / "Models" / "Killers"
            if killers_sub.exists():
                shutil.copytree(killers_sub, psx_enemy_dest / "Killers", dirs_exist_ok=True)
        shutil.rmtree(tmp_extract, ignore_errors=True)
        ingested_packs.append(psx_rar.name)

    # 10b. Modular Character Outfits - Fantasy[Standard](1).zip -> Modular Parts
    for mod_zip_name in ("Modular Character Outfits - Fantasy[Standard](1).zip", "Modular Character Outfits - Fantasy[Standard].zip"):
        mod_zip = DOWNLOADS_DIR / mod_zip_name
        mod_parts_dest = PACKS_ROOT / "characters_3d" / "fantasy_modular_parts"
        if mod_zip.exists() and not mod_parts_dest.exists():
            mod_parts_dest.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(mod_zip, "r") as z:
                for member in z.namelist():
                    if "Exports/glTF (Godot-Unreal)/Modular Parts/" in member and not member.endswith("/"):
                        fname = Path(member).name
                        (mod_parts_dest / fname).write_bytes(z.read(member))
            ingested_packs.append(mod_zip_name)
            break

    # 10c. Sync Ultima / Britannia 3D glTF models from parent /home/me/Videos/AMDHACKTHREE/public/models/environment
    parent_env_models = REPO_ROOT.parent / "public" / "models" / "environment"
    brit_dest = PACKS_ROOT / "environments_3d" / "Ultima_Britannia_3D"
    if parent_env_models.exists() and not brit_dest.exists():
        brit_dest.mkdir(parents=True, exist_ok=True)
        for gltf_f in sorted(parent_env_models.glob("*.gltf"))[:35]:
            shutil.copy2(gltf_f, brit_dest / gltf_f.name)
            bin_f = gltf_f.with_suffix(".bin")
            if bin_f.exists():
                shutil.copy2(bin_f, brit_dest / bin_f.name)
        for png_f in sorted(parent_env_models.glob("*.png"))[:40]:
            shutil.copy2(png_f, brit_dest / png_f.name)
        ingested_packs.append("Ultima_Britannia_3D (public/models)")

    # 11. Universal Scanner for ANY other recent .zip archive dropped in ~/Downloads (within last 72h)
    import time
    now_ts = time.time()
    skip_prefixes = ("pfocw", "a pocket full", "torch fps", "antigravity", "splatmart", "sourcecode", "t-engine")
    known_zips = {
        "(DEMO) Lords Of Pain - Old School Isometric Assets.zip",
        "FREE Character HD Survivor W Bike.zip",
        "KayKit_Dungeon_Pack_1.1_FREE.zip",
        "KayKit_Halloween_Crypts_1.0.zip",
        "Kenney_Particle_Pack.zip",
        "Kenney_Graveyard_Kit.zip",
        "Kenney_Castle_Kit.zip",
        "Quaternius_Animated_Monsters.zip",
        "Quaternius_RPG_Characters.zip",
        "Quaternius_Modular_Dungeon.zip",
        "Quaternius_Medieval_Weapons.zip",
        "FLARE_Dark_Ruins_Isometric.zip",
        "0x72_DungeonTileset_II.zip",
        "PixelFrog_Tiny_Swords.zip",
        "Modular Character Outfits - Fantasy[Standard].zip",
        "Modular Character Outfits - Fantasy[Standard](1).zip",
        "Universal Animation Library[Standard].zip",
        "Universal Animation Library 2[Standard].zip",
        "ModularCastle_AssetPack-Ver2.zip",
        "BattleFXFree.zip",
    }
    for zpath in sorted(DOWNLOADS_DIR.glob("*.zip")):
        if zpath.name in known_zips:
            continue
        if any(zpath.name.lower().startswith(p) for p in skip_prefixes):
            continue
        if (now_ts - zpath.stat().st_mtime) > 72 * 3600:
            continue
        safe_stem = "".join([c if c.isalnum() or c in "_-" else "_" for c in zpath.stem]).strip("_")
        try:
            with zipfile.ZipFile(zpath, "r") as z:
                names_low = [n.lower() for n in z.namelist()]
                has_3d = any(n.endswith((".glb", ".gltf", ".fbx", ".obj")) for n in names_low)
                has_2d = any(n.endswith(".png") for n in names_low)
                if not has_3d and not has_2d:
                    continue
                target_cat = "environments_3d" if has_3d else "sprites_and_tiles_2d"
                if any(k in zpath.stem.lower() for k in ["char", "hero", "knight", "survivor", "adventurer"]):
                    target_cat = "characters_3d" if has_3d else "sprites_and_tiles_2d"
                elif any(k in zpath.stem.lower() for k in ["monster", "enemy", "skeleton", "zombie", "boss"]):
                    target_cat = "enemies_3d" if has_3d else "sprites_and_tiles_2d"
                elif any(k in zpath.stem.lower() for k in ["weapon", "sword", "gun", "armory"]):
                    target_cat = "weapons_3d"
                elif any(k in zpath.stem.lower() for k in ["vfx", "particle", "effect", "shader"]):
                    target_cat = "effects_3d_2d"
                dest_dir = PACKS_ROOT / target_cat / safe_stem
                if not dest_dir.exists():
                    dest_dir.mkdir(parents=True, exist_ok=True)
                    z.extractall(dest_dir)
                    ingested_packs.append(zpath.name)
        except Exception:
            continue

    # 12. Scan for any loose .glb/.gltf/.gdshader/.aseprite/.bvh/.fbx/.png files dropped directly into ~/Downloads
    for ext in ("*.glb", "*.gltf", "*.gdshader", "*.aseprite", "*.bvh", "*.fbx"):
        for f in DOWNLOADS_DIR.glob(ext):
            target_folder = "animations_3d" if f.suffix.lower() in (".bvh", ".fbx") else (
                "effects_3d_2d" if f.suffix.lower() == ".gdshader" else (
                    "sprites_and_tiles_2d" if f.suffix.lower() == ".aseprite" else "characters_3d"
                )
            )
            dest = PACKS_ROOT / target_folder / f.name
            if not dest.exists():
                shutil.copy2(f, dest)
                ingested_packs.append(f.name)

    # Ensure godot_kernel/assets/custom_asset_packs and frontend/public/custom_asset_packs symlinks exist
    for link_path in [REPO_ROOT / "godot_kernel" / "assets" / "custom_asset_packs", REPO_ROOT / "frontend" / "public" / "custom_asset_packs"]:
        link_path.parent.mkdir(parents=True, exist_ok=True)
        if not link_path.exists() and not link_path.is_symlink():
            try:
                link_path.symlink_to(PACKS_ROOT, target_is_directory=True)
            except Exception:
                pass

    return ingested_packs


def run_headless_blender_conversion_and_inspection():
    """Runs Headless Blender on any unconverted priority .fbx/.obj files to generate .glb."""
    blender_bin = shutil.which("blender") or "/snap/bin/blender"
    if not blender_bin or not Path(blender_bin).exists():
        return

    unconverted_fbx = [
        f for f in PACKS_ROOT.rglob("*.fbx")
        if (f.name in PRIORITY_FBX_MODELS or f.name in PRIORITY_CASTLE_FBX) and not f.with_suffix(".glb").exists()
    ]
    if not unconverted_fbx:
        return

    blender_inline_code = r"""
import bpy
import json
from pathlib import Path

PACKS_ROOT = Path("custom_asset_packs").resolve()
PRIORITY_FBX = """ + repr(PRIORITY_FBX_MODELS | PRIORITY_CASTLE_FBX) + r"""

def bind_texture(src_file: Path):
    tex_candidates = list(src_file.parent.glob("*.png")) + list(src_file.parent.parent.glob("*.png"))
    psx_tex_dir = src_file.parent.parent / "Textures"
    if psx_tex_dir.exists():
        stem_num = "".join([c for c in src_file.stem if c.isdigit()])
        matched = [p for p in psx_tex_dir.glob("*.png") if stem_num and stem_num in p.stem]
        tex_candidates = (matched or list(psx_tex_dir.glob("*.png"))) + tex_candidates
    if not tex_candidates:
        return
    tex_path = sorted(tex_candidates)[0]
    img = bpy.data.images.load(str(tex_path), check_existing=True)
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if len(obj.data.materials) == 0:
            mat = bpy.data.materials.new(name=f"Mat_{src_file.stem}")
            mat.use_nodes = True
            obj.data.materials.append(mat)
        for mat in obj.data.materials:
            if not mat:
                continue
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
            has_tex = any(n.type == 'TEX_IMAGE' for n in nodes)
            if bsdf and not has_tex:
                tex_node = nodes.new('ShaderNodeTexImage')
                tex_node.image = img
                links.new(bsdf.inputs['Base Color'], tex_node.outputs['Color'])

converted = 0
for src_file in sorted(PACKS_ROOT.rglob("*.fbx")):
    if src_file.name not in PRIORITY_FBX:
        continue
    target_glb = src_file.with_suffix(".glb")
    if not target_glb.exists():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        try:
            bpy.ops.import_scene.fbx(filepath=str(src_file))
            bind_texture(src_file)
            bpy.ops.export_scene.gltf(filepath=str(target_glb), export_format='GLB', export_animations=True)
            converted += 1
            print(f"[Blender Converted] {src_file.name} -> {target_glb.name}")
        except Exception as e:
            print(f"[Blender Skip] {src_file.name}: {e}")
print(f"[Blender Conversion] Converted {converted} new FBX files to GLB.")
"""
    script_file = Path("/tmp/_agy_blender_sync_helper.py")
    script_file.write_text(blender_inline_code)
    subprocess.run([blender_bin, "-b", "-P", str(script_file)], cwd=str(REPO_ROOT), check=False)
    script_file.unlink(missing_ok=True)


def inspect_gltf_fast(gltf_path: Path, cache: Dict[str, Any]) -> Dict[str, Any]:
    """Reads GLTF or GLB binary JSON chunk directly (or uses cache) for instant bounding box, skeleton, and animation metadata."""
    stem = gltf_path.stem
    if stem in cache and "dimensions" in cache[stem]:
        return cache[stem]

    try:
        data = None
        if gltf_path.suffix.lower() == ".glb":
            with open(gltf_path, "rb") as f:
                header = f.read(20)
                if len(header) == 20:
                    magic, version, total_len, chunk_len, chunk_type = struct.unpack("<IIIII", header)
                    if magic == 0x46546C67 and chunk_type == 0x4E4F534A:
                        data = json.loads(f.read(chunk_len).decode("utf-8", errors="ignore"))
        else:
            data = json.loads(gltf_path.read_text(errors="ignore"))

        if not isinstance(data, dict):
            raise ValueError("Invalid GLTF/GLB JSON")

        nodes = data.get("nodes", [])
        skins = data.get("skins", [])
        meshes = data.get("meshes", [])
        anims_raw = data.get("animations", [])
        accessors = data.get("accessors", [])

        bones = []
        if skins:
            joint_indices = skins[0].get("joints", [])
            bones = [nodes[idx].get("name", f"bone_{idx}") for idx in joint_indices if idx < len(nodes)]
        else:
            # Also check node hierarchy for bone-like names
            for n in nodes:
                nm = n.get("name", "")
                if any(k in nm.lower() for k in ["mixamorig:", "hand", "arm", "leg", "spine", "head", "root", "bone"]):
                    bones.append(nm)

        hand_r, hand_l, head_b = None, None, None
        for b in bones:
            bl = b.lower()
            if not hand_r and any(k in bl for k in ["righthand", "hand.r", "hand_r", "handslot.r", "weapon_r", "r_hand"]):
                hand_r = b
            if not hand_l and any(k in bl for k in ["lefthand", "hand.l", "hand_l", "handslot.l", "weapon_l", "l_hand"]):
                hand_l = b
            if not head_b and "head" in bl:
                head_b = b

        min_v = [999.0, 999.0, 999.0]
        max_v = [-999.0, -999.0, -999.0]
        for acc in accessors:
            if acc.get("type") == "VEC3" and "min" in acc and "max" in acc:
                amin, amax = acc["min"], acc["max"]
                if len(amin) == 3 and len(amax) == 3:
                    for i in range(3):
                        min_v[i] = min(min_v[i], float(amin[i]))
                        max_v[i] = max(max_v[i], float(amax[i]))

        dims = [round(max_v[i] - min_v[i], 3) if max_v[i] > min_v[i] else 1.0 for i in range(3)]
        ground_offset = round(-min_v[1], 3) if min_v[1] < 900 else 0.0
        anim_names = [a.get("name", f"anim_{i}") for i, a in enumerate(anims_raw)]

        res = {
            "has_mesh": len(meshes) > 0,
            "has_skeleton": len(bones) > 0,
            "right_hand_bone": hand_r,
            "left_hand_bone": hand_l,
            "head_bone": head_b,
            "bones_count": len(bones),
            "skeleton_bones": bones[:45],
            "animations": anim_names,
            "animation_clips": [{"name": n, "frames": 30, "duration": 1.25} for n in anim_names],
            "dimensions": dims,
            "ground_offset_y": ground_offset,
        }
        cache[stem] = res
        return res
    except Exception:
        return {
            "has_mesh": True,
            "has_skeleton": False,
            "right_hand_bone": None,
            "left_hand_bone": None,
            "head_bone": None,
            "bones_count": 0,
            "skeleton_bones": [],
            "animations": [],
            "animation_clips": [],
            "dimensions": [1.0, 1.0, 1.0],
            "ground_offset_y": 0.0,
        }


def get_png_dimensions(png_path: Path):
    """Reads PNG width & height from the IHDR header without heavy image libraries."""
    try:
        with open(png_path, "rb") as f:
            header = f.read(24)
            if header[:8] == b"\x89PNG\r\n\x1a\n" and header[12:16] == b"IHDR":
                w, h = struct.unpack(">II", header[16:24])
                return int(w), int(h)
    except Exception:
        pass
    return 128, 128


def build_unified_asset_registry(ingested_packs: List[str] = None) -> Dict[str, Any]:
    """Indexes all 3D and 2D assets in custom_asset_packs/ into asset_registry.json."""
    if ingested_packs is None:
        ingested_packs = []

    cache_path = PACKS_ROOT / ".glb_inspection_cache.json"
    cache = {}
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text())
        except Exception:
            cache = {}

    characters_3d = []
    enemies_3d = []
    weapons_3d = []
    environments_3d = []
    animations_3d = []
    effects_3d_2d = []
    sprites_and_tiles_2d = []

    seen_ids_by_cat = {
        "characters_3d": set(),
        "enemies_3d": set(),
        "weapons_3d": set(),
        "environments_3d": set(),
        "animations_3d": set(),
        "effects_3d_2d": set(),
    }

    search_order = [PACKS_ROOT / d for d in CATEGORY_DIRS if (PACKS_ROOT / d).exists()]
    for extra in PACKS_ROOT.iterdir():
        if extra.is_dir() and extra not in search_order and not extra.name.startswith("_"):
            search_order.append(extra)

    for folder in search_order:
        for ext in ("*.glb", "*.gltf"):
            for asset_path in sorted(folder.rglob(ext)):
                if asset_path.suffix.lower() == ".gltf" and asset_path.with_suffix(".glb").exists():
                    continue
                rel_path = asset_path.relative_to(PACKS_ROOT)
                rel_str = str(rel_path).replace("\\", "/")
                rel_url = "/custom_assets/" + rel_str
                stem = asset_path.stem
                name_low = (stem + " " + rel_str).lower()

                meta = inspect_gltf_fast(asset_path, cache)

                if "characters_psx" in rel_str.lower():
                    pack_name = "Characters_psx (PSX Heroes & Monsters)"
                elif "quaternius_monsters" in rel_str.lower():
                    pack_name = "Quaternius Ultimate Animated Monsters"
                elif "quaternius_rpg_heroes" in rel_str.lower():
                    pack_name = "Quaternius Ultimate Modular RPG Characters"
                elif "quaternius_modular_dungeon" in rel_str.lower():
                    pack_name = "Quaternius LowPoly Modular Dungeon"
                elif "quaternius_medieval_weapons" in rel_str.lower():
                    pack_name = "Quaternius Medieval Weapons Pack"
                elif "kenney_graveyard" in rel_str.lower():
                    pack_name = "Kenney Graveyard Kit 5.0"
                elif "kenney_castle" in rel_str.lower():
                    pack_name = "Kenney Castle Kit"
                elif "kaykit_halloween" in rel_str.lower():
                    pack_name = "KayKit Spooktober Crypts 1.0"
                elif "kaykit_dungeon" in rel_str.lower():
                    pack_name = "KayKit_Dungeon_Pack_1.1_FREE"
                elif "fantasy_outfits" in rel_str.lower() or "mannequin" in rel_str.lower():
                    pack_name = "Modular Character Outfits - Fantasy[Standard]"
                elif "ual" in stem.lower():
                    pack_name = "Universal Animation Library [Standard] 1 & 2"
                elif "modularcastle" in rel_str.lower():
                    pack_name = "ModularCastle_AssetPack-Ver2"
                elif "battlefx" in rel_str.lower():
                    pack_name = "BattleFXFree (BinbunVFX Vol2)"
                else:
                    pack_name = "Custom RPG Character & Weapon Pack"

                # Detect modular armor/clothing parts vs full heroes
                is_modular_part = any(k in stem.lower() for k in [
                    "_arms", "_body", "_feet", "_legs", "_acc_", "_head_", "pauldrons", "pauldron", "_boots", "_hood"
                ])

                entry = {
                    "id": stem,
                    "pack": pack_name,
                    "url": rel_url,
                    "dimension": "3D",
                    "is_modular_part": is_modular_part,
                    **meta,
                }

                # 1. Directory routing takes strict priority
                if "animations" in rel_str or (len(entry["animations"]) > 0 and "ual" in name_low):
                    cat = "animations_3d"
                    target_list = animations_3d
                elif "effects" in rel_str or any(k in name_low for k in ["battlefx", "slash.gdshader", "shield_aura"]):
                    cat = "effects_3d_2d"
                    target_list = effects_3d_2d
                elif "enemies_3d" in rel_str or "quaternius_monsters" in rel_str.lower() or "graveyard_monsters" in rel_str.lower() or "characters_psx_killers" in rel_str.lower():
                    cat = "enemies_3d"
                    target_list = enemies_3d
                elif "weapons_3d" in rel_str or "quaternius_medieval_weapons" in rel_str.lower() or "only weapons" in rel_str.lower():
                    cat = "weapons_3d"
                    target_list = weapons_3d
                elif "environments" in rel_str or "kenney_castle" in rel_str.lower() or "modularcastle" in rel_str.lower() or "kaykit_dungeon" in rel_str.lower() or "kaykit_halloween" in rel_str.lower():
                    cat = "environments_3d"
                    target_list = environments_3d
                elif "characters" in rel_str or "quaternius_rpg_heroes" in rel_str.lower() or "characters_psx" in rel_str.lower():
                    cat = "characters_3d"
                    target_list = characters_3d
                else:
                    # Semantic word-boundary fallback
                    words = set(re.findall(r"[a-zA-Z0-9]+", name_low))
                    weapon_words = {
                        "sword", "swords", "axe", "axes", "bow", "bows", "crossbow", "crossbows",
                        "staff", "staves", "dagger", "daggers", "hammer", "hammers", "shield", "shields",
                        "blade", "blades", "quiver", "arrow", "arrows", "wand", "wands", "spellbook",
                        "claymore", "scythe", "mace", "halberd"
                    }
                    enemy_words = {
                        "enemy", "boss", "monster", "killer", "killers", "skeleton", "skeletons",
                        "orc", "orcs", "demon", "demons", "zombie", "zombies", "vampire", "vampires",
                        "ghost", "ghosts", "dragon", "dragons", "slime", "slimes", "bat", "bats"
                    }
                    if words & weapon_words:
                        cat = "weapons_3d"
                        target_list = weapons_3d
                    elif words & enemy_words:
                        cat = "enemies_3d"
                        target_list = enemies_3d
                    elif entry.get("has_skeleton", False):
                        cat = "characters_3d"
                        target_list = characters_3d
                    else:
                        cat = "environments_3d"
                        target_list = environments_3d

                if stem not in seen_ids_by_cat[cat]:
                    seen_ids_by_cat[cat].add(stem)
                    target_list.append(entry)

    try:
        cache_path.write_text(json.dumps(cache, indent=2))
    except Exception:
        pass

    # Index 3D & 2D Shaders, HDRs, and VFX Textures in effects_3d_2d/
    fx_root = PACKS_ROOT / "effects_3d_2d"
    seen_fx = {e["id"] for e in effects_3d_2d}
    if fx_root.exists():
        for ext in ("*.gdshader", "*.hdr", "*.tscn", "*.png", "*.webp"):
            for fx_path in sorted(fx_root.rglob(ext)):
                if fx_path.stem in seen_fx:
                    continue
                seen_fx.add(fx_path.stem)
                rel_url = "/custom_assets/" + str(fx_path.relative_to(PACKS_ROOT)).replace("\\", "/")
                fx_type = "vfx_shader" if fx_path.suffix == ".gdshader" else (
                    "vfx_hdr_env" if fx_path.suffix == ".hdr" else (
                        "vfx_prefab_tscn" if fx_path.suffix == ".tscn" else "vfx_texture"
                    )
                )
                pack_label = (
                    "Kenney Particle Pack (CC0 VFX)" if "Kenney_Particle_Pack" in str(fx_path) else
                    "UltimateToonSource" if "UltimateToonSource" in str(fx_path) else
                    "BattleFXFree (BinbunVFX Vol2)"
                )
                effects_3d_2d.append({
                    "id": fx_path.stem,
                    "pack": pack_label,
                    "url": rel_url,
                    "dimension": "2D/3D",
                    "type": fx_type
                })

    # Index 2D Spritesheets, Isometric Animation Sets, and Tilesets in sprites_and_tiles_2d/
    sprites_root = PACKS_ROOT / "sprites_and_tiles_2d"
    if sprites_root.exists():
        # 1. HD_Survivor_2D horizontal spritesheets
        surv_dir = sprites_root / "HD_Survivor_2D"
        if surv_dir.exists():
            for png in sorted(surv_dir.rglob("*.png")):
                w, h = get_png_dimensions(png)
                frames = max(1, round(w / h)) if h > 0 else 1
                rel_url = "/custom_assets/" + str(png.relative_to(PACKS_ROOT)).replace("\\", "/")
                sprites_and_tiles_2d.append({
                    "id": f"Survivor2D_{png.stem}",
                    "name": f"HD Survivor - {png.stem}",
                    "pack": "FREE Character HD Survivor W Bike",
                    "role": "character_spritesheet_2d",
                    "animation": png.stem,
                    "url": rel_url,
                    "width": w,
                    "height": h,
                    "frame_count": frames,
                    "dimension": "2D"
                })

        # 2. (DEMO) Lords Of Pain - Old School Isometric Assets
        lop_dir = sprites_root / "LordsOfPain_Isometric"
        if lop_dir.exists():
            anim_groups: Dict[str, List[Path]] = {}
            for png in sorted(lop_dir.rglob("*.png")):
                rel_parts = png.relative_to(lop_dir).parts
                if "environment" in rel_parts or "prop" in rel_parts or "user interface" in rel_parts or "vfx" in rel_parts:
                    w, h = get_png_dimensions(png)
                    rel_url = "/custom_assets/" + str(png.relative_to(PACKS_ROOT)).replace("\\", "/")
                    role = (
                        "tileset_2d" if "environment" in rel_parts else
                        "prop_2d" if "prop" in rel_parts else
                        "ui_indicator_2d" if "user interface" in rel_parts else "vfx_2d"
                    )
                    if png.stem.endswith("_0") or "environment" in rel_parts:
                        sprites_and_tiles_2d.append({
                            "id": f"LordsOfPain_{png.stem}",
                            "name": png.stem.replace("_", " ").title(),
                            "pack": "(DEMO) Lords Of Pain - Old School Isometric Assets",
                            "role": role,
                            "url": rel_url,
                            "width": w,
                            "height": h,
                            "dimension": "2D"
                        })
                elif len(rel_parts) >= 4:
                    entity_type = rel_parts[1]
                    char_name = rel_parts[2]
                    anim_folder = rel_parts[3]
                    key = f"{entity_type}/{char_name}/{anim_folder}"
                    anim_groups.setdefault(key, []).append(png)

            for key, png_list in sorted(anim_groups.items()):
                entity_type, char_name, anim_folder = key.split("/")
                rep_png = next((p for p in png_list if "/S/" in str(p) and p.stem.endswith("_0")), png_list[0])
                w, h = get_png_dimensions(rep_png)
                rel_url = "/custom_assets/" + str(rep_png.relative_to(PACKS_ROOT)).replace("\\", "/")
                sample_frames = [
                    "/custom_assets/" + str(p.relative_to(PACKS_ROOT)).replace("\\", "/")
                    for p in png_list[:16]
                ]
                sprites_and_tiles_2d.append({
                    "id": f"Iso2D_{anim_folder}",
                    "name": f"Isometric {char_name.title()} - {anim_folder.replace('_', ' ').title()}",
                    "pack": "(DEMO) Lords Of Pain - Old School Isometric Assets",
                    "role": "enemy_sprite_2d" if "enemy" in entity_type.lower() else "player_sprite_2d",
                    "entity": char_name,
                    "animation": anim_folder,
                    "url": rel_url,
                    "sample_frames": sample_frames,
                    "total_directional_frames": len(png_list),
                    "width": w,
                    "height": h,
                    "dimension": "2D"
                })

        # 3. FLARE Dark Ruins Isometric Pack
        flare_dir = sprites_root / "FLARE_Dark_Ruins_Isometric"
        if flare_dir.exists():
            for png in sorted(flare_dir.rglob("*.png"))[:25]:
                w, h = get_png_dimensions(png)
                rel_url = "/custom_assets/" + str(png.relative_to(PACKS_ROOT)).replace("\\", "/")
                sprites_and_tiles_2d.append({
                    "id": f"FLARE_Iso_{png.stem}",
                    "name": f"FLARE Dark Ruins Tile {png.stem}",
                    "pack": "FLARE Dark Ruins Isometric Pack",
                    "role": "tileset_2d",
                    "url": rel_url,
                    "width": w,
                    "height": h,
                    "dimension": "2D"
                })

        # 4. 0x72 16x16 DungeonTileset II
        d72_dir = sprites_root / "0x72_DungeonTileset_II"
        if d72_dir.exists():
            for png in sorted(d72_dir.rglob("*.png"))[:60]:
                w, h = get_png_dimensions(png)
                rel_url = "/custom_assets/" + str(png.relative_to(PACKS_ROOT)).replace("\\", "/")
                sprites_and_tiles_2d.append({
                    "id": f"0x72_{png.stem}",
                    "name": f"0x72 Dungeon {png.stem}",
                    "pack": "0x72 16x16 DungeonTileset II",
                    "role": "character_spritesheet_2d" if any(k in png.stem.lower() for k in ["knight", "wizzard", "elf", "lizard", "skelet", "demon", "goblin", "orc"]) else "tileset_2d",
                    "url": rel_url,
                    "width": w,
                    "height": h,
                    "dimension": "2D"
                })

        # 5. Pixel Frog Tiny Swords
        tiny_dir = sprites_root / "PixelFrog_Tiny_Swords"
        if tiny_dir.exists():
            for png in sorted(tiny_dir.rglob("*.png"))[:50]:
                w, h = get_png_dimensions(png)
                rel_url = "/custom_assets/" + str(png.relative_to(PACKS_ROOT)).replace("\\", "/")
                sprites_and_tiles_2d.append({
                    "id": f"TinySwords_{png.parent.name}_{png.stem}",
                    "name": f"Tiny Swords {png.parent.name} - {png.stem}",
                    "pack": "Pixel Frog Tiny Swords",
                    "role": "character_spritesheet_2d" if any(k in str(png).lower() for k in ["warrior", "archer", "pawn", "torch", "tnt", "knights", "goblins"]) else "tileset_2d",
                    "url": rel_url,
                    "width": w,
                    "height": h,
                    "dimension": "2D"
                })

    registry = {
        "characters_3d": characters_3d,
        "enemies_3d": enemies_3d,
        "weapons_3d": weapons_3d,
        "environments_3d": environments_3d,
        "animations_3d": animations_3d,
        "effects_3d_2d": effects_3d_2d,
        "sprites_and_tiles_2d": sprites_and_tiles_2d,
        "characters": characters_3d,
        "enemies": enemies_3d,
        "weapons": weapons_3d,
        "environment": environments_3d,
        "animations": animations_3d,
        "effects": effects_3d_2d,
        "ingested_packs": ingested_packs,
        "summary": {
            "characters_3d": len(characters_3d),
            "enemies_3d": len(enemies_3d),
            "weapons_3d": len(weapons_3d),
            "environments_3d": len(environments_3d),
            "animations_3d": len(animations_3d),
            "effects_3d_2d": len(effects_3d_2d),
            "sprites_and_tiles_2d": len(sprites_and_tiles_2d),
        }
    }

    REGISTRY_PATH.write_text(json.dumps(registry, indent=2))
    return registry


def sync_all_user_assets() -> Dict[str, Any]:
    ensure_directories_and_preserve_existing()
    ingested = ingest_downloads()
    run_headless_blender_conversion_and_inspection()
    registry = build_unified_asset_registry(ingested)
    print("[SyncAllUserAssets] Registry Summary:", json.dumps(registry.get("summary", {}), indent=2))
    return registry


if __name__ == "__main__":
    sync_all_user_assets()
