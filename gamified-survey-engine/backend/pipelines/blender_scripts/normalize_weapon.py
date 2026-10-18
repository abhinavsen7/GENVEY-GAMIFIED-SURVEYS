import bpy
import sys
import os
import mathutils

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
if len(argv) < 2:
    print("Usage: blender -b -P normalize_weapon.py -- <input_glb> <output_glb>")
    sys.exit(0)

input_glb = argv[0]
output_glb = argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_glb)

meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
if not meshes:
    print(f"No meshes found in {input_glb}")
    sys.exit(1)

bpy.context.view_layer.objects.active = meshes[0]
for m in meshes:
    m.select_set(True)
if len(meshes) > 1:
    bpy.ops.object.join()

weapon = bpy.context.active_object
weapon.name = "GeneratedWeapon"

# Normalize scale to 1.2 meters length and shift grip (bottom 20% of Z bounds) to origin
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bbox = [weapon.matrix_world @ mathutils.Vector(corner) for corner in weapon.bound_box]
min_z = min(v.z for v in bbox)
max_z = max(v.z for v in bbox)
height = max(max_z - min_z, 0.001)
scale_factor = 1.2 / height
weapon.scale = (scale_factor, scale_factor, scale_factor)
bpy.ops.object.transform_apply(scale=True)

bbox = [weapon.matrix_world @ mathutils.Vector(corner) for corner in weapon.bound_box]
min_z = min(v.z for v in bbox)
grip_offset_z = min_z + 0.18
weapon.location.z -= grip_offset_z
bpy.ops.object.transform_apply(location=True)

os.makedirs(os.path.dirname(output_glb), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=output_glb, export_format='GLB')
print(f"Normalized weapon exported to {output_glb}")
