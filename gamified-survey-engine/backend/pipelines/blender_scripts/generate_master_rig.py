import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Create Armature
bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 1.0))
armature_obj = bpy.context.active_object
armature_obj.name = "GodotHumanoidRig"
arm_data = armature_obj.data
arm_data.name = "ArmatureData"

# Clear default bone
eb = arm_data.edit_bones
for b in list(eb):
    eb.remove(b)

# Define Bones in Edit Mode
def add_bone(name, head, tail, parent_name=None):
    bone = eb.new(name)
    bone.head = head
    bone.tail = tail
    if parent_name and parent_name in eb:
        bone.parent = eb[parent_name]
    return bone

add_bone("Hips", (0, 0, 1.0), (0, 0, 1.15))
add_bone("Spine", (0, 0, 1.15), (0, 0, 1.35), "Hips")
add_bone("Spine1", (0, 0, 1.35), (0, 0, 1.55), "Spine")
add_bone("Neck", (0, 0, 1.55), (0, 0, 1.65), "Spine1")
add_bone("Head", (0, 0, 1.65), (0, 0, 1.85), "Neck")

# Left Leg
add_bone("LeftUpLeg", (0.1, 0, 1.0), (0.1, 0, 0.55), "Hips")
add_bone("LeftLeg", (0.1, 0, 0.55), (0.1, 0, 0.1), "LeftUpLeg")
add_bone("LeftFoot", (0.1, 0, 0.1), (0.1, 0.15, 0.0), "LeftLeg")

# Right Leg
add_bone("RightUpLeg", (-0.1, 0, 1.0), (-0.1, 0, 0.55), "Hips")
add_bone("RightLeg", (-0.1, 0, 0.55), (-0.1, 0, 0.1), "RightUpLeg")
add_bone("RightFoot", (-0.1, 0, 0.1), (-0.1, 0.15, 0.0), "RightLeg")

# Left Arm
add_bone("LeftArm", (0.15, 0, 1.5), (0.4, 0, 1.5), "Spine1")
add_bone("LeftForeArm", (0.4, 0, 1.5), (0.65, 0, 1.5), "LeftArm")
add_bone("LeftHand", (0.65, 0, 1.5), (0.75, 0, 1.5), "LeftForeArm")

# Right Arm
add_bone("RightArm", (-0.15, 0, 1.5), (-0.4, 0, 1.5), "Spine1")
add_bone("RightForeArm", (-0.4, 0, 1.5), (-0.65, 0, 1.5), "RightArm")
add_bone("RightHand", (-0.65, 0, 1.5), (-0.75, 0, 1.5), "RightForeArm")

bpy.ops.object.mode_set(mode='OBJECT')

# Add Body Mesh
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(0, 0, 1.75))
head_mesh = bpy.context.active_object
head_mesh.name = "HeadMesh"

bpy.ops.mesh.primitive_cube_add(size=0.4, location=(0, 0, 1.35))
torso_mesh = bpy.context.active_object
torso_mesh.scale = (0.7, 0.4, 1.0)
torso_mesh.name = "TorsoMesh"

# Join meshes
bpy.context.view_layer.objects.active = torso_mesh
head_mesh.select_set(True)
torso_mesh.select_set(True)
bpy.ops.object.join()
humanoid_mesh = bpy.context.active_object
humanoid_mesh.name = "HumanoidMesh"

# Parent to armature
humanoid_mesh.select_set(True)
armature_obj.select_set(True)
bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# Add RightHandSocket Empty
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(-0.75, 0, 1.5))
socket = bpy.context.active_object
socket.name = "RightHandSocket"
socket.parent = armature_obj
socket.parent_type = 'BONE'
socket.parent_bone = "RightHand"

# Export GLB
out_path = os.path.abspath("godot_kernel/assets/rig/MasterHumanoid.glb")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', export_animations=True)
print(f"MasterHumanoid generated successfully at {out_path}")
