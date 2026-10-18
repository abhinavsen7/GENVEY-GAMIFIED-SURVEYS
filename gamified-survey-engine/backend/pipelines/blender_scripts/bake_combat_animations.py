import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Create Armature with Full Humanoid Hierarchy & RightHandSocket
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm = bpy.context.active_object
arm.name = "MasterHumanoid"
arm.data.name = "ArmatureData"
ebones = arm.data.edit_bones

# Root & Spine
hips = ebones[0]
hips.name = "Hips"
hips.head = (0, 0, 1.0)
hips.tail = (0, 0, 1.2)

spine = ebones.new("Spine")
spine.head = (0, 0, 1.2)
spine.tail = (0, 0, 1.55)
spine.parent = hips

neck = ebones.new("Neck")
neck.head = (0, 0, 1.55)
neck.tail = (0, 0, 1.65)
neck.parent = spine

head = ebones.new("Head")
head.head = (0, 0, 1.65)
head.tail = (0, 0, 1.85)
head.parent = neck

# Right Arm & Hand
r_arm = ebones.new("RightArm")
r_arm.head = (-0.25, 0, 1.5)
r_arm.tail = (-0.55, 0, 1.25)
r_arm.parent = spine

r_hand = ebones.new("RightHand")
r_hand.head = (-0.55, 0, 1.25)
r_hand.tail = (-0.7, 0, 1.15)
r_hand.parent = r_arm

# Left Arm & Hand
l_arm = ebones.new("LeftArm")
l_arm.head = (0.25, 0, 1.5)
l_arm.tail = (0.55, 0, 1.25)
l_arm.parent = spine

l_hand = ebones.new("LeftHand")
l_hand.head = (0.55, 0, 1.25)
l_hand.tail = (0.7, 0, 1.15)
l_hand.parent = l_arm

# Legs
r_leg = ebones.new("RightUpLeg")
r_leg.head = (-0.15, 0, 1.0)
r_leg.tail = (-0.15, 0, 0.5)
r_leg.parent = hips

l_leg = ebones.new("LeftUpLeg")
l_leg.head = (0.15, 0, 1.0)
l_leg.tail = (0.15, 0, 0.5)
l_leg.parent = hips

bpy.ops.object.mode_set(mode='OBJECT')

# 2. Add Dark Fantasy Knight Torso, Pauldrons & Helm Mesh
bpy.ops.mesh.primitive_cylinder_add(radius=0.24, depth=0.65, location=(0, 0, 1.3))
torso = bpy.context.active_object
torso.name = "KnightTorso"

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0, 0, 1.75))
helm = bpy.context.active_object
helm.name = "KnightHelm"

# Visor slit on helm
bpy.ops.mesh.primitive_cube_add(size=0.15, location=(0, -0.16, 1.75))
visor = bpy.context.active_object
visor.scale = (1.4, 0.2, 0.25)

# Pauldrons
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.14, location=(-0.3, 0, 1.55))
r_pauldron = bpy.context.active_object
r_pauldron.name = "RightPauldron"

bpy.ops.mesh.primitive_ico_sphere_add(radius=0.14, location=(0.3, 0, 1.55))
l_pauldron = bpy.context.active_object
l_pauldron.name = "LeftPauldron"

# Join armor pieces into a unified mesh
bpy.context.view_layer.objects.active = torso
for obj in [helm, visor, r_pauldron, l_pauldron]:
    obj.select_set(True)
bpy.ops.object.join()
armor_mesh = bpy.context.active_object
armor_mesh.name = "KnightArmor"

# Parent to Armature
armor_mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# Add RightHandSocket Empty for Godot Weapon Mounting
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(-0.7, 0, 1.15))
socket = bpy.context.active_object
socket.name = "RightHandSocket"
socket.parent = arm
socket.parent_type = 'BONE'
socket.parent_bone = "RightHand"

# 3. Bake Skeletal Action Clips into NLA Tracks
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
arm.animation_data_create()

r_arm_pose = arm.pose.bones["RightArm"]
r_hand_pose = arm.pose.bones["RightHand"]
spine_pose = arm.pose.bones["Spine"]
hips_pose = arm.pose.bones["Hips"]

# Track 1: CustomSlash (Gemma 4 Vision Timings: Windup 1->10, Hitbox 10->18, Recovery 18->30)
slash_action = bpy.data.actions.new(name="CustomSlash")
arm.animation_data.action = slash_action

bpy.context.scene.frame_set(1)
r_arm_pose.rotation_quaternion = (1, 0, 0, 0)
spine_pose.rotation_quaternion = (1, 0, 0, 0)
r_arm_pose.keyframe_insert(data_path="rotation_quaternion", frame=1)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=1)

# Frame 10 (0.32 ratio): High Overhead Windup
bpy.context.scene.frame_set(10)
r_arm_pose.rotation_quaternion = (0.707, -0.707, 0.2, 0.0)
spine_pose.rotation_quaternion = (0.98, -0.15, 0.1, 0.0)
r_arm_pose.keyframe_insert(data_path="rotation_quaternion", frame=10)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=10)

# Frame 18 (0.58 ratio): Cleave Follow-Through Impact
bpy.context.scene.frame_set(18)
r_arm_pose.rotation_quaternion = (0.707, 0.65, -0.2, 0.0)
spine_pose.rotation_quaternion = (0.95, 0.25, -0.1, 0.0)
r_arm_pose.keyframe_insert(data_path="rotation_quaternion", frame=18)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=18)

# Frame 30 (1.0 ratio): Return to Guard
bpy.context.scene.frame_set(30)
r_arm_pose.rotation_quaternion = (1, 0, 0, 0)
spine_pose.rotation_quaternion = (1, 0, 0, 0)
r_arm_pose.keyframe_insert(data_path="rotation_quaternion", frame=30)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=30)

# Push to NLA Track
track_slash = arm.animation_data.nla_tracks.new()
track_slash.name = "CustomSlashTrack"
track_slash.strips.new("CustomSlash", 1, slash_action)

# Track 2: Idle (Frames 1 -> 40 subtle breathing)
idle_action = bpy.data.actions.new(name="Idle")
arm.animation_data.action = idle_action
bpy.context.scene.frame_set(1)
hips_pose.location = (0, 0, 0)
spine_pose.rotation_quaternion = (1, 0, 0, 0)
hips_pose.keyframe_insert(data_path="location", frame=1)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=1)

bpy.context.scene.frame_set(20)
hips_pose.location = (0, 0, -0.02)
spine_pose.rotation_quaternion = (0.998, 0.05, 0, 0)
hips_pose.keyframe_insert(data_path="location", frame=20)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=20)

bpy.context.scene.frame_set(40)
hips_pose.location = (0, 0, 0)
spine_pose.rotation_quaternion = (1, 0, 0, 0)
hips_pose.keyframe_insert(data_path="location", frame=40)
spine_pose.keyframe_insert(data_path="rotation_quaternion", frame=40)

track_idle = arm.animation_data.nla_tracks.new()
track_idle.name = "IdleTrack"
track_idle.strips.new("Idle", 1, idle_action)

# Track 3: DodgeRoll (Frames 1 -> 24 acrobatic roll)
roll_action = bpy.data.actions.new(name="DodgeRoll")
arm.animation_data.action = roll_action
bpy.context.scene.frame_set(1)
hips_pose.rotation_quaternion = (1, 0, 0, 0)
hips_pose.keyframe_insert(data_path="rotation_quaternion", frame=1)

bpy.context.scene.frame_set(12)
hips_pose.rotation_quaternion = (0.0, 1.0, 0, 0) # 180 deg pitch forward
hips_pose.keyframe_insert(data_path="rotation_quaternion", frame=12)

bpy.context.scene.frame_set(24)
hips_pose.rotation_quaternion = (-1.0, 0, 0, 0) # 360 deg
hips_pose.keyframe_insert(data_path="rotation_quaternion", frame=24)

track_roll = arm.animation_data.nla_tracks.new()
track_roll.name = "DodgeRollTrack"
track_roll.strips.new("DodgeRoll", 1, roll_action)

# Set active back to slash
arm.animation_data.action = slash_action

bpy.ops.object.mode_set(mode='OBJECT')

out_path = os.path.abspath("godot_kernel/assets/rig/MasterHumanoid.glb")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_animations=True
)
print("Successfully baked skeletal animations (CustomSlash, Idle, DodgeRoll) into MasterHumanoid.glb")
