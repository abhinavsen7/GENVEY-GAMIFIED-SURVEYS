import bpy
import bmesh
import sys
import json
import math

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
if len(argv) < 2:
    print("Usage: blender -b -P procedural_weapon_forge.py -- '<spec_json>' <output_glb>")
    sys.exit(0)

spec_json_str = argv[0]
output_glb = argv[1]

try:
    spec = json.loads(spec_json_str)
except Exception:
    spec = {"archetype": "GREATSWORD", "blade_length": 1.15, "blade_width": 0.12, "shader_color_hex": "#ef4444"}

archetype = str(spec.get("archetype", "GREATSWORD")).upper()
blade_len = float(spec.get("blade_length", 1.1))
blade_w = float(spec.get("blade_width", 0.11))
hex_color = str(spec.get("shader_color_hex", "#ff3b10")).lstrip("#")
if len(hex_color) != 6:
    hex_color = "ff3b10"
r = int(hex_color[0:2], 16) / 255.0
g = int(hex_color[2:4], 16) / 255.0
b = int(hex_color[4:6], 16) / 255.0

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Create Dark Metal + Elemental Emissive PBR Materials
mat_metal = bpy.data.materials.new(name="ObsidianAlloy")
mat_metal.use_nodes = True
bsdf = mat_metal.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.1, 0.11, 0.13, 1.0)
bsdf.inputs["Metallic"].default_value = 0.92
bsdf.inputs["Roughness"].default_value = float(spec.get("metallic_roughness", 0.22))

mat_glow = bpy.data.materials.new(name="ElementalCore")
mat_glow.use_nodes = True
bsdf_glow = mat_glow.node_tree.nodes.get("Principled BSDF")
bsdf_glow.inputs["Base Color"].default_value = (r, g, b, 1.0)
if "Emission Color" in bsdf_glow.inputs:
    bsdf_glow.inputs["Emission Color"].default_value = (r, g, b, 1.0)
    bsdf_glow.inputs["Emission Strength"].default_value = float(spec.get("emission_strength", 4.5))

parts = []

# 2. Grip & Pommel (Grip centered at origin 0,0,0 for RightHandSocket)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.024, depth=0.24, location=(0, 0, 0.0))
grip = bpy.context.active_object
grip.data.materials.append(mat_metal)
parts.append(grip)

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.048, location=(0, 0, -0.14))
pommel = bpy.context.active_object
pommel.data.materials.append(mat_glow)
parts.append(pommel)

# 3. Crossguard
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.14))
guard = bpy.context.active_object
guard.scale = (blade_w * 2.2, 0.045, 0.035)
bpy.ops.object.transform_apply(scale=True)
bevel = guard.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.01
bevel.segments = 3
bpy.ops.object.modifier_apply(modifier="Bevel")
guard.data.materials.append(mat_metal)
parts.append(guard)

# 4. Archetype-Specific Geometry
if archetype == "WARHAMMER":
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.022, depth=blade_len, location=(0, 0, 0.14 + blade_len * 0.5))
    shaft = bpy.context.active_object
    shaft.data.materials.append(mat_metal)
    parts.append(shaft)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.14 + blade_len * 0.9))
    head = bpy.context.active_object
    head.scale = (0.24, 0.13, 0.14)
    bpy.ops.object.transform_apply(scale=True)
    head.data.materials.append(mat_metal)
    parts.append(head)

    # Glowing strike face
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.13, 0, 0.14 + blade_len * 0.9))
    strike_face = bpy.context.active_object
    strike_face.scale = (0.02, 0.11, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    strike_face.data.materials.append(mat_glow)
    parts.append(strike_face)

elif archetype == "RAPIER":
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.008, depth=blade_len, location=(0, 0, 0.14 + blade_len * 0.5))
    needle = bpy.context.active_object
    needle.data.materials.append(mat_metal)
    parts.append(needle)

    # Glowing rapier core
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.004, depth=blade_len * 0.85, location=(0, 0, 0.14 + blade_len * 0.45))
    needle_core = bpy.context.active_object
    needle_core.data.materials.append(mat_glow)
    parts.append(needle_core)

    # Cup Guard
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(0, 0, 0.12))
    cup = bpy.context.active_object
    cup.scale = (1.0, 1.0, 0.6)
    bpy.ops.object.transform_apply(scale=True)
    cup.data.materials.append(mat_metal)
    parts.append(cup)

elif archetype == "SCYTHE":
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.02, depth=blade_len, location=(0, 0, 0.14 + blade_len * 0.5))
    staff = bpy.context.active_object
    staff.data.materials.append(mat_metal)
    parts.append(staff)

    # Crescent curved blade
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.08, depth=0.75, location=(0.35, 0, 0.14 + blade_len * 0.95))
    scythe_blade = bpy.context.active_object
    scythe_blade.rotation_euler = (0, math.radians(75), 0)
    scythe_blade.scale = (1.0, 0.15, 1.0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    scythe_blade.data.materials.append(mat_glow)
    parts.append(scythe_blade)

else: # GREATSWORD / SWORD
    # Tapered Diamond Blade
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=blade_w, radius2=0.008, depth=blade_len, location=(0, 0, 0.14 + blade_len * 0.5))
    blade = bpy.context.active_object
    blade.scale = (1.0, 0.22, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    blade.data.materials.append(mat_metal)
    parts.append(blade)

    # Inner glowing fuller vein
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=blade_w * 0.22, depth=blade_len * 0.75, location=(0, 0, 0.14 + blade_len * 0.42))
    core = bpy.context.active_object
    core.scale = (0.3, 1.15, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    core.data.materials.append(mat_glow)
    parts.append(core)

# 5. Join & Export Normalized GLB
bpy.ops.object.select_all(action='DESELECT')
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()

bpy.ops.export_scene.gltf(filepath=output_glb, export_format='GLB')
print(f"[CPU Blender Forge] Exported {archetype} to {output_glb}")
