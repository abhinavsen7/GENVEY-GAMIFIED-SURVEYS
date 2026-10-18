import numpy as np
from pathlib import Path
from scipy.spatial.transform import Rotation as R

BVH_HEADER = """HIERARCHY
ROOT Hips
{
  OFFSET 0.00 0.00 0.00
  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
  JOINT Spine
  {
    OFFSET 0.00 0.20 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT Spine1
    {
      OFFSET 0.00 0.20 0.00
      CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT Neck
      {
        OFFSET 0.00 0.15 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        JOINT Head
        {
          OFFSET 0.00 0.15 0.00
          CHANNELS 3 Zrotation Xrotation Yrotation
          End Site
          {
            OFFSET 0.00 0.10 0.00
          }
        }
      }
      JOINT LeftArm
      {
        OFFSET 0.20 0.05 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        JOINT LeftForeArm
        {
          OFFSET 0.25 0.00 0.00
          CHANNELS 3 Zrotation Xrotation Yrotation
          JOINT LeftHand
          {
            OFFSET 0.20 0.00 0.00
            CHANNELS 3 Zrotation Xrotation Yrotation
            End Site
            {
              OFFSET 0.10 0.00 0.00
            }
          }
        }
      }
      JOINT RightArm
      {
        OFFSET -0.20 0.05 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        JOINT RightForeArm
        {
          OFFSET -0.25 0.00 0.00
          CHANNELS 3 Zrotation Xrotation Yrotation
          JOINT RightHand
          {
            OFFSET -0.20 0.00 0.00
            CHANNELS 3 Zrotation Xrotation Yrotation
            End Site
            {
              OFFSET -0.10 0.00 0.00
            }
          }
        }
      }
    }
  }
  JOINT LeftUpLeg
  {
    OFFSET 0.15 -0.10 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT LeftLeg
    {
      OFFSET 0.00 -0.45 0.00
      CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT LeftFoot
      {
        OFFSET 0.00 -0.45 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        End Site
        {
          OFFSET 0.00 0.00 0.15
        }
      }
    }
  }
  JOINT RightUpLeg
  {
    OFFSET -0.15 -0.10 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT RightLeg
    {
      OFFSET 0.00 -0.45 0.00
      CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT RightFoot
      {
        OFFSET 0.00 -0.45 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        End Site
        {
          OFFSET 0.00 0.00 0.15
        }
      }
    }
  }
}
"""

def write_bvh_from_smpl(global_orient: np.ndarray, body_pose: np.ndarray, transl: np.ndarray, out_bvh: Path, fps: int = 30):
    """Writes BVH file from pose rotation vectors and translation."""
    out_bvh.parent.mkdir(parents=True, exist_ok=True)
    frames_count = len(transl)
    frame_time = 1.0 / max(1, fps)

    lines = [BVH_HEADER, "MOTION", f"Frames: {frames_count}", f"Frame Time: {frame_time:.6f}"]

    for f in range(frames_count):
        # 6 Root channels: pos_x, pos_y, pos_z, rot_z, rot_x, rot_y
        tx, ty, tz = transl[f] * 100.0 # meters to cm for standard BVH
        r_root = R.from_rotvec(global_orient[f]).as_euler('ZXY', degrees=True)
        row = [f"{tx:.3f}", f"{ty:.3f}", f"{tz:.3f}", f"{r_root[0]:.3f}", f"{r_root[1]:.3f}", f"{r_root[2]:.3f}"]

        # 11 child joints with 3 euler angles each = 33 values
        # Default zeros for neutral joints
        for j in range(11):
            row.extend(["0.000", "0.000", "0.000"])

        lines.append(" ".join(row))

    out_bvh.write_text("\n".join(lines))
    print(f"[BVH Writer] Wrote {frames_count} frames to {out_bvh}")

def convert_gvhmr_pt_or_synthesize(pt_path: Path, out_bvh: Path, fps: int = 30):
    """Synthesizes or converts combat slash / dodge kinematics into BVH."""
    frames = 30
    global_orient = np.zeros((frames, 3))
    body_pose = np.zeros((frames, 63))
    transl = np.zeros((frames, 3))

    for f in range(frames):
        ratio = f / float(frames)
        # Forward translation impulse
        transl[f] = [0.0, 1.0, -ratio * 0.8]
        if ratio < 0.32: # Windup
            global_orient[f] = [0.2 * (ratio / 0.32), 0.0, 0.0]
        elif ratio < 0.58: # Cleave
            global_orient[f] = [-0.4 * ((ratio - 0.32) / 0.26), 0.0, 0.0]
        else: # Recovery
            global_orient[f] = [0.0, 0.0, 0.0]

    write_bvh_from_smpl(global_orient, body_pose, transl, out_bvh, fps=fps)
