import open3d as o3d
import glob
import os
import numpy as np
from multiprocessing import Pool, cpu_count

SRC_DIR = "frames_ascii"
OUT_DIR = "frames_clean"
THREADS = 16  # change here

os.makedirs(OUT_DIR, exist_ok=True)

files = sorted(glob.glob(f"{SRC_DIR}/*.ply"))


def process_file(f):
    try:
        pcd = o3d.io.read_point_cloud(f)
        xyz = np.asarray(pcd.points)

        # convert colors: float0-1 → uint8
        if pcd.has_colors():
            colors = (np.asarray(pcd.colors) * 255).astype(np.uint8)
        else:
            colors = np.zeros((xyz.shape[0], 3), dtype=np.uint8)

        # output filename
        out = os.path.join(OUT_DIR, os.path.basename(f))

        # write Three.js-compatible ASCII PLY
        with open(out, "w") as fp:
            fp.write("ply\nformat ascii 1.0\n")
            fp.write(f"element vertex {xyz.shape[0]}\n")
            fp.write("property float x\nproperty float y\nproperty float z\n")
            fp.write("property uchar red\nproperty uchar green\nproperty uchar blue\n")
            fp.write("end_header\n")

            for (x, y, z), (r, g, b) in zip(xyz, colors):
                fp.write(f"{x} {y} {z} {r} {g} {b}\n")

        print(f"[OK] {out}")
        return True

    except Exception as e:
        print(f"[ERROR] {f}: {e}")
        return False


if __name__ == "__main__":
    print(f"Using {THREADS} threads (CPU has {cpu_count()})")
    print(f"Processing {len(files)} PLY files...\n")

    with Pool(THREADS) as p:
        p.map(process_file, files)

    print("\nDONE — all cleaned PLYs saved to:", OUT_DIR)

