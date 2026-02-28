import open3d as o3d
import glob
import os

files = sorted(glob.glob("frames/*.ply"))

out_dir = "frames_ascii"
os.makedirs(out_dir, exist_ok=True)

for f in files:
    pcd = o3d.io.read_point_cloud(f)
    out = os.path.join(out_dir, os.path.basename(f))
    o3d.io.write_point_cloud(out, pcd, write_ascii=True)
    print("Converted:", out)

