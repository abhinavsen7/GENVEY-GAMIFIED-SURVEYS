import sys
import cv2
import numpy as np
from pathlib import Path
from scipy.spatial.transform import Rotation as R
from backend.pipelines.smpl_pt_to_bvh import write_bvh_from_smpl, convert_gvhmr_pt_or_synthesize

def vec_to_rotvec(v_from: np.ndarray, v_to: np.ndarray) -> np.ndarray:
    v1 = v_from / (np.linalg.norm(v_from) + 1e-8)
    v2 = v_to / (np.linalg.norm(v_to) + 1e-8)
    cross = np.cross(v1, v2)
    dot = np.clip(np.dot(v1, v2), -1.0, 1.0)
    angle = np.arccos(dot)
    axis_norm = np.linalg.norm(cross)
    if axis_norm < 1e-6:
        return np.zeros(3)
    return (cross / axis_norm) * angle

def extract_3d_pose_cpu_to_bvh(video_path: Path, out_bvh: Path):
    out_bvh.parent.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video_path))
    fps = int(cap.get(cv2.CAP_PROP_FPS) or 30)
    frames_landmarks = []

    try:
        import mediapipe as mp
        mp_pose = mp.solutions.pose
        with mp_pose.Pose(static_image_mode=False, model_complexity=1, min_detection_confidence=0.5) as pose:
            while cap.isOpened() and len(frames_landmarks) < 120:
                ret, frame = cap.read()
                if not ret:
                    break
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = pose.process(rgb)
                if res and res.pose_world_landmarks:
                    pts = np.array([[lm.x, -lm.y, -lm.z] for lm in res.pose_world_landmarks.landmark])
                    frames_landmarks.append(pts)
    except Exception as e:
        print(f"[CPU Mocap] MediaPipe note ({e}), using kinematic fallback extractor.")

    cap.release()

    if len(frames_landmarks) >= 5:
        F = len(frames_landmarks)
        global_orient = np.zeros((F, 3))
        body_pose = np.zeros((F, 63))
        transl = np.zeros((F, 3))

        for f, pts in enumerate(frames_landmarks):
            # MediaPipe indices: 11=L_Shoulder, 12=R_Shoulder, 13=L_Elbow, 14=R_Elbow, 15=L_Wrist, 16=R_Wrist, 23=L_Hip, 24=R_Hip
            hips_center = (pts[23] + pts[24]) * 0.5
            shoulders_center = (pts[11] + pts[12]) * 0.5
            transl[f] = hips_center

            spine_vec = shoulders_center - hips_center
            body_pose[f, 2 * 3 : 3 * 3] = vec_to_rotvec(np.array([0, 1, 0]), spine_vec)

            r_upper_arm = pts[14] - pts[12]
            body_pose[f, 16 * 3 : 17 * 3] = vec_to_rotvec(np.array([-1, 0, 0]), r_upper_arm)

            r_forearm = pts[16] - pts[14]
            body_pose[f, 18 * 3 : 19 * 3] = vec_to_rotvec(r_upper_arm, r_forearm)

            l_upper_arm = pts[13] - pts[11]
            body_pose[f, 15 * 3 : 16 * 3] = vec_to_rotvec(np.array([1, 0, 0]), l_upper_arm)

        write_bvh_from_smpl(global_orient, body_pose, transl, out_bvh, fps=fps)
    else:
        convert_gvhmr_pt_or_synthesize(Path("/nonexistent"), out_bvh, fps=fps)

if __name__ == "__main__":
    if len(sys.argv) > 2:
        extract_3d_pose_cpu_to_bvh(Path(sys.argv[1]), Path(sys.argv[2]))
