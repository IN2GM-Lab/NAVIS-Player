# NAVIS-Player
NAVIS is a browser-native volumetric media player for interactive playback of dynamic PLY point-cloud sequences. It combines WebGL rendering, parallel Web Worker parsing, buffered streaming-style playback, and integrated performance metrics to enable smooth 6DoF visualization directly in the browser without native dependencies.

Open the page in a modern browser, choose a folder of `.ply` frames from your filesystem, and scrub/play them with orbit or fly navigation.

## Get the code
```bash
git clone https://github.com/Jazkiel/Dynamic_PLY_Renderder.git
cd Dynamic_PLY_Renderder
```

## Features
- **Local-first loading:** Pick any folder of ASCII `.ply` frames; files are read via browser file handles and never leave your machine.
- **Smooth playback:** Play/pause, frame stepping, loop toggle, speed control, and quick timeline scrubbing.
- **Dual navigation modes:** Orbit for object-centric viewing; Explore for WASD/QE flying with roll and adjustable wheel-based speed.
- **Rendering controls:** Point size, downsample slider, per-frame normalization toggle, color modes (source/greyscale/mono), floor plane, and themed backgrounds/UI.
- **Streaming knobs:** Prefetch/keep-behind/cache limits and concurrency cap to balance startup latency vs. memory.
- **Subtitles:** Load VTT/SRT to sync captions by frame index; customize FPS mapping, position, color, and size.
- **Dev overlay:** Optional HUD with points, frame index, performance timings, memory, HMD position/angle, and speed.

## Requirements
- Modern desktop browser (Chrome/Edge recommended)
- Simple HTTP server to host the page (browsers block `file://` fetches for scripts/workers). Python 3 is enough.

## Run locally
1) From the `viewer` directory, start a server:
   ```bash
   cd viewer/
   python3 -m http.server 8000
   ```
2) Open the player:
   ```
   http://localhost:8000
   ```
3) Click **“Choose folder”** and select your `.ply` frame directory. Playback stays local; the server only serves the app files.

## Loading your sequence
- Organize frames sequentially (e.g., `AnyName_0000.ply`, `AnyName_0001.ply`, …). Zero padding is auto-detected.
- The picker maps files in order; nested subfolders are supported when using the system directory picker.
- Need tweaks? Open **Advanced → Video source** to edit:
  - **Base path (prefix)**
  - **Total frames**
  - **Pad digits**

## Controls
- **Space:** Play/Pause
- **← / →:** Step ±1 frame (Shift for ±10)
- **Loop:** Toggle looping
- **Speed:** Select playback rate
- **Timeline slider:** Scrub frames
- **Mode toggle:** Orbit ⇄ Explore
- **Explore (fly) keys:** W/A/S/D move, Z/C down/up, Q/E roll, Shift boost, Ctrl precision
- **Mouse wheel (Explore):** Adjust fly speed
- **R:** Reset view
- **F:** Fullscreen

## Advanced options
Located under **“Show advanced”**:
- **Streaming:** Start buffer, prefetch ahead, keep behind, cache cap, concurrency cap.
- **Navigation:** Base speed, boost/slow multipliers, look sensitivity.
- **Rendering:** Color mode, point size, downsample ratio, background theme, UI theme, floor toggle, per-frame normalization.
- **Subtitles:** Load VTT/SRT; set FPS, position, color, size.
- **Dev overlay:** Toggle perf/geometry stats.

## File structure
- `viewer/index.html` — UI shell and styles.
- `viewer/js/player.js` — Playback, streaming, rendering, input, subtitles.
- `viewer/js/plyWorker.js` — Worker-based ASCII PLY parser.
- `viewer/js/three.min.js`, `viewer/js/OrbitControls.js` — Three.js runtime.
- `viewer/sample_subtitles.srt` — Subtitle example (PLY sequences are not included; load your own via the picker).

## Troubleshooting
- Blank scene: check pad digits/base prefix in **Advanced → Video source** and ensure frames are selected.
- Folder picker blocked: try Chrome/Edge.
- Slow loads: lower concurrency or prefetch/cache; downsample for lighter renders.

## License

NAVIS is open-source software released under the Apache License 2.0.  
See the `LICENSE` file for full details.

## Contributing

Contributions are welcome.  
Feel free to open an issue or submit a pull request for bug fixes, improvements, or new features.

By contributing, you agree that your contributions will be licensed under Apache 2.0.

## Citation

If you use NAVIS in your research, please cite our paper:

## ACM Reference Format

```text
Sidhu, J. S., Ouellette, J., and Bentaleb, A. 2026.
NAVIS: Web-Native Interactive Visualization of Dynamic Point-Cloud Video.
In Proceedings of the 17th ACM Multimedia Systems Conference 2026 (MMSys '26),
April 4-8, 2026, Hong Kong, Hong Kong. ACM, New York, NY, USA, 6 pages.
https://doi.org/10.1145/3793853.3798192
```

### BibTeX

```bibtex
@inproceedings{sidhu2026navis,
  author    = {Sidhu, Jashanjot Singh and Ouellette, J{\'e}r{\'e}my and Bentaleb, Abdelhak},
  title     = {NAVIS: Web-Native Interactive Visualization of Dynamic Point-Cloud Video},
  booktitle = {Proceedings of the 17th ACM Multimedia Systems Conference 2026 (MMSys '26)},
  year      = {2026},
  month     = apr,
  address   = {Hong Kong, Hong Kong},
  publisher = {ACM},
  doi       = {10.1145/3793853.3798192}
}
```
