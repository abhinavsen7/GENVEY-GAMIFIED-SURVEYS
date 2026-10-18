import subprocess
from pathlib import Path
from backend.pipelines.cpu_video_mocap import extract_3d_pose_cpu_to_bvh

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
STORAGE_ANIMS = BASE_DIR / "storage" / "generated_anims"
BLENDER_RETARGET_SCRIPT = BASE_DIR / "pipelines" / "blender_scripts" / "auto_rig_retarget.py"
MASTER_RIG = PROJECT_ROOT / "godot_kernel" / "assets" / "rig" / "MasterHumanoid.glb"

def video_to_godot_animation(video_path: str, anim_id: str) -> str:
    STORAGE_ANIMS.mkdir(parents=True, exist_ok=True)
    output_glb = STORAGE_ANIMS / f"{anim_id}.glb"
    extracted_bvh = STORAGE_ANIMS / f"{anim_id}.bvh"

    try:
        extract_3d_pose_cpu_to_bvh(Path(video_path), extracted_bvh)
    except Exception as e:
        print(f"[MotionExtractor] CPU extraction note ({e})")

    if extracted_bvh.exists() and MASTER_RIG.exists():
        try:
            subprocess.run([
                "blender", "-b", "-P", str(BLENDER_RETARGET_SCRIPT),
                "--", str(extracted_bvh), str(MASTER_RIG), str(output_glb)
            ], check=True, stdout=subprocess.DEVNULL)
        except Exception as e:
            print(f"[MotionExtractor] Retargeting note ({e})")
            if MASTER_RIG.exists() and not output_glb.exists():
                output_glb.write_bytes(MASTER_RIG.read_bytes())
    elif MASTER_RIG.exists() and not output_glb.exists():
        output_glb.write_bytes(MASTER_RIG.read_bytes())

    return f"/assets/anims/{anim_id}.glb"
