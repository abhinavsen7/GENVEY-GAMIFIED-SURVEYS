import bpy
import bmesh
import math
from pathlib import Path

OUT_DIR = Path("backend/storage/generated_glb")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Also copy to frontend public directory so Vite can serve static models directly
FRONTEND_WEAPONS_DIR = Path("frontend/public/models/weapons")
FRONTEND_WEAPONS_DIR.mkdir(parents=True, exist_ok=True)
FRONTEND_ENV_DIR = Path("frontend/public/models/environment")
FRONTEND_ENV_DIR.mkdir(parents=True, exist_ok=True)

def create_pbr_material(name, base_rgba, metallic, roughness, emission_rgb=(0,0,0), emission_str=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_rgba
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission_str > 0.0:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission_rgb, 1.0)
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emission_rgb, 1.0)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_str
    return mat

def sculpt_dark_fantasy_greatsword(filename: str, glow_rgb=(1.0, 0.22, 0.05)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat_steel = create_pbr_material("DamascusSteel", (0.14, 0.15, 0.18, 1.0), 0.95, 0.18)
    mat_obsidian = create_pbr_material("ObsidianCore", (0.04, 0.04, 0.05, 1.0), 0.85, 0.12)
    mat_rune = create_pbr_material("RuneGlow", (*glow_rgb, 1.0), 0.2, 0.1, glow_rgb, 8.0)

    parts = []

    # 1. Sculpted Tapered Blade with Fuller Blood-Groove & Serrated Ricasso
    mesh = bpy.data.meshes.new("SculptedBlade")
    bm = bmesh.new()
    segments = 24
    blade_len = 1.25
    prev_ring = None
    for i in range(segments + 1):
        t = i / segments
        z = 0.16 + t * blade_len
        # Non-linear leaf/flamberge wave taper
        w = 0.095 * (1.0 - (t ** 1.6)) + 0.012 * math.sin(t * math.pi * 6.0) * (1.0 - t)
        thick = 0.018 * (1.0 - t * 0.7)
        # Diamond + fuller cross-section (6 vertices per ring)
        ring = [
            bm.verts.new((-w, 0.0, z)),
            bm.verts.new((-w * 0.35, thick, z)),
            bm.verts.new((w * 0.35, thick, z)),
            bm.verts.new((w, 0.0, z)),
            bm.verts.new((w * 0.35, -thick, z)),
            bm.verts.new((-w * 0.35, -thick, z)),
        ]
        if i > 0 and prev_ring:
            for k in range(6):
                v1, v2 = prev_ring[k], prev_ring[(k + 1) % 6]
                v3, v4 = ring[(k + 1) % 6], ring[k]
                bm.faces.new((v1, v2, v3, v4))
        prev_ring = ring

    # Tip cap
    if prev_ring:
        tip_v = bm.verts.new((0.0, 0.0, 0.16 + blade_len + 0.08))
        for k in range(6):
            bm.faces.new((prev_ring[k], prev_ring[(k + 1) % 6], tip_v))

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    blade_obj = bpy.data.objects.new("Blade", mesh)
    bpy.context.collection.objects.link(blade_obj)
    blade_obj.data.materials.append(mat_steel)
    parts.append(blade_obj)

    # 2. Curved Winged Crossguard
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.025, location=(0, 0, 0.28), rotation=(math.pi/2, 0, 0))
    guard = bpy.context.active_object
    guard.scale = (1.1, 0.35, 0.4)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    guard.data.materials.append(mat_obsidian)
    parts.append(guard)

    # 3. Glowing Rune Energy Vein along Fuller
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.014, depth=0.95, location=(0, 0, 0.68))
    vein = bpy.context.active_object
    vein.scale = (0.4, 1.35, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    vein.data.materials.append(mat_rune)
    parts.append(vein)

    # 4. Ribbed Leather/Wire Grip & Claw Pommel (Grip centered at 0,0,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.024, depth=0.28, location=(0, 0, 0.0))
    grip = bpy.context.active_object
    grip.data.materials.append(mat_obsidian)
    parts.append(grip)

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.045, location=(0, 0, -0.16))
    pommel = bpy.context.active_object
    pommel.data.materials.append(mat_rune)
    parts.append(pommel)

    # Smooth shading and join
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
        if hasattr(p.data, "polygons"):
            for poly in p.data.polygons:
                poly.use_smooth = True
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    out_backend = OUT_DIR / filename
    out_frontend = FRONTEND_WEAPONS_DIR / filename
    bpy.ops.export_scene.gltf(filepath=str(out_backend), export_format='GLB')
    bpy.ops.export_scene.gltf(filepath=str(out_frontend), export_format='GLB')
    print(f"[Sculpt Highpoly] Exported {filename}")

def sculpt_void_rapier(filename: str = "void_rapier.glb", glow_rgb=(0.22, 0.74, 1.0)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat_silver = create_pbr_material("Quicksilver", (0.85, 0.88, 0.92, 1.0), 0.98, 0.12)
    mat_dark = create_pbr_material("DarkSteel", (0.08, 0.08, 0.1, 1.0), 0.9, 0.2)
    mat_rune = create_pbr_material("VoidSparks", (*glow_rgb, 1.0), 0.1, 0.1, glow_rgb, 9.0)

    parts = []

    # Slender Rapier Needle Blade (1.1m)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.018, radius2=0.002, depth=1.1, location=(0, 0, 0.65))
    needle = bpy.context.active_object
    needle.data.materials.append(mat_silver)
    parts.append(needle)

    # Swept Hilt Cup / Basket Guard
    bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.015, location=(0, 0, 0.14), rotation=(0, 0, 0))
    cup1 = bpy.context.active_object
    cup1.data.materials.append(mat_dark)
    parts.append(cup1)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.012, location=(0, 0, 0.20), rotation=(math.pi/4, 0, 0))
    cup2 = bpy.context.active_object
    cup2.data.materials.append(mat_dark)
    parts.append(cup2)

    # Core Spark Ring
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.035, location=(0, 0, 0.15))
    core = bpy.context.active_object
    core.data.materials.append(mat_rune)
    parts.append(core)

    # Grip (centered at 0,0,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.016, depth=0.22, location=(0, 0, 0.0))
    grip = bpy.context.active_object
    grip.data.materials.append(mat_dark)
    parts.append(grip)

    # Pommel
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.032, location=(0, 0, -0.12))
    pommel = bpy.context.active_object
    pommel.data.materials.append(mat_rune)
    parts.append(pommel)

    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
        if hasattr(p.data, "polygons"):
            for poly in p.data.polygons:
                poly.use_smooth = True
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    bpy.ops.export_scene.gltf(filepath=str(OUT_DIR / filename), export_format='GLB')
    bpy.ops.export_scene.gltf(filepath=str(FRONTEND_WEAPONS_DIR / filename), export_format='GLB')
    print(f"[Sculpt Highpoly] Exported {filename}")

def sculpt_gothic_pillar(filename: str = "gothic_pillar.glb"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat_stone = create_pbr_material("AncientStone", (0.16, 0.15, 0.16, 1.0), 0.1, 0.85)
    mat_moss = create_pbr_material("DarkGargoyle", (0.09, 0.1, 0.09, 1.0), 0.15, 0.7)
    mat_glow = create_pbr_material("TorchRunes", (1.0, 0.5, 0.1, 1.0), 0.1, 0.2, (1.0, 0.5, 0.1), 6.0)

    parts = []

    # Base Pedestal (Layered square plinth)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.15))
    base1 = bpy.context.active_object
    base1.scale = (0.7, 0.7, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    base1.data.materials.append(mat_stone)
    parts.append(base1)

    # Fluted Column Shaft (height 3.2m)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.32, depth=3.2, location=(0, 0, 1.9))
    col = bpy.context.active_object
    col.data.materials.append(mat_stone)
    parts.append(col)

    # Fluted ribs around column
    for angle in [0, math.pi/4, math.pi/2, 3*math.pi/4, math.pi, 5*math.pi/4, 3*math.pi/2, 7*math.pi/4]:
        rx = 0.32 * math.cos(angle)
        ry = 0.32 * math.sin(angle)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.045, depth=3.1, location=(rx, ry, 1.9))
        rib = bpy.context.active_object
        rib.data.materials.append(mat_moss)
        parts.append(rib)

    # Capital Crown Molding
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 3.65))
    cap = bpy.context.active_object
    cap.scale = (0.75, 0.75, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    cap.data.materials.append(mat_stone)
    parts.append(cap)

    # Torch Sconce Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=0.38, minor_radius=0.03, location=(0, 0, 2.1))
    sconce = bpy.context.active_object
    sconce.data.materials.append(mat_glow)
    parts.append(sconce)

    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
        if hasattr(p.data, "polygons"):
            for poly in p.data.polygons:
                poly.use_smooth = True
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    bpy.ops.export_scene.gltf(filepath=str(FRONTEND_ENV_DIR / filename), export_format='GLB')
    print(f"[Sculpt Highpoly] Exported {filename}")

if __name__ == "__main__":
    sculpt_dark_fantasy_greatsword("obsidian_cleaver.glb", (1.0, 0.22, 0.04))
    sculpt_dark_fantasy_greatsword("sunfire_halberd.glb", (1.0, 0.78, 0.1))
    sculpt_void_rapier("void_rapier.glb", (0.22, 0.74, 1.0))
    sculpt_gothic_pillar("gothic_pillar.glb")
    print("Exported high-poly sculpted weapons and gothic architecture.")
