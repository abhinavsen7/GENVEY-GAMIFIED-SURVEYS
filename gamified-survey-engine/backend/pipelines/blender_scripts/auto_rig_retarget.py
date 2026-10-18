import bpy
import sys
import os

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
if len(argv) < 3:
    print("Usage: blender -b -P auto_rig_retarget.py -- <source_bvh> <target_rig_glb> <output_glb>")
    sys.exit(0)

source_bvh_path = argv[0]
target_rig_glb = argv[1]
output_glb_path = argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Import Master Humanoid Target Rig
bpy.ops.import_scene.gltf(filepath=target_rig_glb)
target_armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)
if not target_armature:
    print(f"Error: No armature found in {target_rig_glb}")
    sys.exit(1)
target_armature.name = "GodotHumanoidRig"

# 2. Import Source Motion Capture (.bvh from GVHMR / MoMask)
bpy.ops.import_anim.bvh(filepath=source_bvh_path, axis_forward='-Z', axis_up='Y')
source_armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE' and obj != target_armature), None)
if not source_armature:
    print(f"Error: No source armature found in {source_bvh_path}")
    sys.exit(1)

# 3. Map Core Bone Hierarchy via Copy Rotation / Location Constraints
BONE_MAP = {
    "Hips": "Hips",
    "Spine": "Spine",
    "Chest": "Spine1",
    "Neck": "Neck",
    "Head": "Head",
    "LeftUpLeg": "LeftUpLeg",
    "LeftLeg": "LeftLeg",
    "LeftFoot": "LeftFoot",
    "RightUpLeg": "RightUpLeg",
    "RightLeg": "RightLeg",
    "RightFoot": "RightFoot",
    "LeftArm": "LeftArm",
    "LeftForeArm": "LeftForeArm",
    "LeftHand": "LeftHand",
    "RightArm": "RightArm",
    "RightForeArm": "RightForeArm",
    "RightHand": "RightHand"
}

bpy.context.view_layer.objects.active = target_armature
bpy.ops.object.mode_set(mode='POSE')

for target_bone_name, source_bone_name in BONE_MAP.items():
    if target_bone_name in target_armature.pose.bones and source_bone_name in source_armature.pose.bones:
        pbone = target_armature.pose.bones[target_bone_name]
        rot_con = pbone.constraints.new('COPY_ROTATION')
        rot_con.target = source_armature
        rot_con.subtarget = source_bone_name
        if target_bone_name == "Hips":
            loc_con = pbone.constraints.new('COPY_LOCATION')
            loc_con.target = source_armature
            loc_con.subtarget = source_bone_name

# 4. Bake Action to Target Skeleton & Remove Source Rig
if source_armature.animation_data and source_armature.animation_data.action:
    frame_start = int(source_armature.animation_data.action.frame_range[0])
    frame_end = int(source_armature.animation_data.action.frame_range[1])
else:
    frame_start = 1
    frame_end = 60

bpy.ops.nla.bake(
    frame_start=frame_start,
    frame_end=frame_end,
    only_selected=False,
    visual_keying=True,
    clear_constraints=True,
    bake_types={'POSE'}
)

bpy.ops.object.mode_set(mode='OBJECT')
bpy.data.objects.remove(source_armature, do_unlink=True)

# 5. Export Retargeted Animation + Rig to glTF 2.0 (.glb) for Godot 4
os.makedirs(os.path.dirname(output_glb_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=output_glb_path,
    export_format='GLB',
    export_animations=True,
    export_frame_range=True,
    export_force_sampling=True
)
print(f"Exported retargeted animation to {output_glb_path}")
