// ============================================================
// GLOBAL CONFIG
// ============================================================
const sequences = [
    { id: "ready", label: "Ready for Winter (UVG)", basePath: "frames_clean/ReadyForWinter_UVG_vox10_25_0_250_", totalFrames: 250, pad: 4 },
    { id: "custom", label: "Custom", basePath: "frames_clean/ReadyForWinter_UVG_vox10_25_0_250_", totalFrames: 250, pad: 4 }
];
const sequenceMap = sequences.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});
const playbackFPS = 30; // base playback rate; speedFactor multiplies this
let currentSequenceId = sequences[0].id;
let totalFrames = sequences[0].totalFrames;
let basePath = sequences[0].basePath;
let padLength = sequences[0].pad;
const pad = (n) => String(n).padStart(padLength, "0");

// Streaming/buffering defaults (tweakable at runtime via Advanced)
const DEFAULT_STREAMING = {
    startBuffer: 30,
    prefetchAhead: 30,
    keepBehind: 5,
    maxCache: 250
};
let startBuffer   = DEFAULT_STREAMING.startBuffer;
let prefetchAhead = DEFAULT_STREAMING.prefetchAhead;
let keepBehind    = DEFAULT_STREAMING.keepBehind;
let maxCache      = DEFAULT_STREAMING.maxCache;
const DEFAULT_MAX_CONCURRENCY  = Math.min(16, Math.max(2, navigator.hardwareConcurrency || 4));

// DOM refs
const playBtn         = document.getElementById("playPause");
const slider          = document.getElementById("slider");
const frameLabel      = document.getElementById("frameLabel");
const speedSelect     = document.getElementById("speed");
const loopBtn         = document.getElementById("loop");
const pointSizeSlider = document.getElementById("pointSize");
const fullscreenBtn   = document.getElementById("fullscreen");
const loaderDiv       = document.getElementById("loader");
const loaderBar       = document.getElementById("loaderBar");
const loaderText      = document.getElementById("loaderText");
const prevFrameBtn    = document.getElementById("prevFrame");
const nextFrameBtn    = document.getElementById("nextFrame");
const back10Btn       = document.getElementById("back10");
const forward10Btn    = document.getElementById("forward10");
const resetViewBtn    = document.getElementById("resetView");
const statusPill      = document.getElementById("statusPill");
const bufferPill      = document.getElementById("bufferPill");
const speedBadge      = document.getElementById("speedBadge");
const pointSizeValue  = document.getElementById("pointSizeValue");
const viewModeToggle  = document.getElementById("viewModeToggle");
const viewModeBadge   = document.getElementById("viewModeBadge");
const advancedToggle  = document.getElementById("advancedToggle");
const advancedPanel   = document.getElementById("advancedPanel");

// Advanced controls
const flyBaseSpeedInput   = document.getElementById("flyBaseSpeed");
const flyBoostMultInput   = document.getElementById("flyBoostMult");
const flySlowMultInput    = document.getElementById("flySlowMult");
const lookSensitivityInput= document.getElementById("lookSensitivity");
const flyBaseSpeedValue   = document.getElementById("flyBaseSpeedValue");
const flyBoostMultValue   = document.getElementById("flyBoostMultValue");
const flySlowMultValue    = document.getElementById("flySlowMultValue");
const lookSensitivityValue= document.getElementById("lookSensitivityValue");

const startBufferInput    = document.getElementById("startBuffer");
const prefetchAheadInput  = document.getElementById("prefetchAhead");
const keepBehindInput     = document.getElementById("keepBehind");
const maxCacheInput       = document.getElementById("maxCache");
const startBufferValue    = document.getElementById("startBufferValue");
const prefetchAheadValue  = document.getElementById("prefetchAheadValue");
const keepBehindValue     = document.getElementById("keepBehindValue");
const maxCacheValue       = document.getElementById("maxCacheValue");
const maxConcurrencyInput = document.getElementById("maxConcurrency");
const maxConcurrencyValue = document.getElementById("maxConcurrencyValue");
const sequenceSelect      = document.getElementById("sequenceSelect");
const selectFolderBtn     = document.getElementById("selectFolderBtn");
const sequenceFolderInput = document.getElementById("sequenceFolder");
const basePathInput       = document.getElementById("basePath");
const totalFramesInput    = document.getElementById("totalFrames");
const totalFramesValue    = document.getElementById("totalFramesValue");
const padLengthInput      = document.getElementById("padLength");
const padLengthValue      = document.getElementById("padLengthValue");
const resetVideoBtn       = document.getElementById("resetVideo");
const subtitleFileInput   = document.getElementById("subtitleFile");
const subtitleFpsInput    = document.getElementById("subtitleFps");
const subtitleFpsValue    = document.getElementById("subtitleFpsValue");
const subtitlesDiv        = document.getElementById("subtitles");
const subtitlePositionSelect = document.getElementById("subtitlePosition");
const subtitleColorInput  = document.getElementById("subtitleColor");
const subtitleSizeInput   = document.getElementById("subtitleSize");
const subtitleSizeValue   = document.getElementById("subtitleSizeValue");
const normalizeToggle     = document.getElementById("normalizeToggle");

const colorModeSelect     = document.getElementById("colorMode");
const downsampleInput     = document.getElementById("downsample");
const downsampleValue     = document.getElementById("downsampleValue");
const backgroundThemeSelect = document.getElementById("backgroundTheme");
const uiThemeSelect       = document.getElementById("uiTheme");
const devInfoToggle       = document.getElementById("devInfoToggle");
const devInfoBox          = document.getElementById("devInfo");
const floorToggle         = document.getElementById("floorToggle");
const backgroundColorInput= document.getElementById("backgroundColor");

const decoder = new TextDecoder();

// Frame cache + loader state
let frameCache = new Map();
let loadQueue  = [];
let loading    = new Set();
let activeInFlight   = 0;
let framesLoaded = 0;
let sequenceVersion = 0;
let localSequence = null; // set when playing directly from a picked folder

// Worker pool for off-main-thread parsing
const workerPool = [];
const pendingParses = new Map();
let workerCursor = 0;
let nextTaskId   = 0;
const WORKER_POOL_LIMIT = 16;

let scene, camera, renderer, geometry, material, pointcloud;
let controls;
let floor;
let floorVisible = true;
let maxConcurrency = DEFAULT_MAX_CONCURRENCY;

let readyToPlay  = false;   // enough frames to start playback
let hasStartedStreaming = false; // user initiated buffering
let fullyLoaded  = false;   // all frames fetched
let buffering    = false;   // buffering until initial frames present
let isPlaying    = false;
let currentFrame = 0;
let loopEnabled  = true;
let speedFactor  = 0.5;

const DEFAULT_POINT_SIZE = parseFloat(pointSizeSlider.value);
const ViewModes = { ORBIT: "orbit", FLY: "fly" };
let viewMode    = ViewModes.ORBIT;
let pointerLocked = false;
let yaw = 0;
let pitch = 0;
let roll = 0;
let prevTime = performance.now();
const flyMoveState = { forward:false, backward:false, left:false, right:false, up:false, down:false };
let flyVelocity = new THREE.Vector3();
const DEFAULT_LOOK_SENSITIVITY = 0.0022;
let lookSensitivity = DEFAULT_LOOK_SENSITIVITY;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const DEFAULT_FLY = {
    base: 3.2,
    boost: 3.0,
    slow: 0.35,
    accel: 24,
    damping: 10,
    rollSpeed: 0.8,
    rollDamping: 8
};
let flyBaseSpeed = DEFAULT_FLY.base;
let flyBoostMult = DEFAULT_FLY.boost;
let flySlowMult  = DEFAULT_FLY.slow;
let flyAccel     = DEFAULT_FLY.accel;
let flyDamping   = DEFAULT_FLY.damping;
let flyWheelScalar = 1;
let shiftHeld = false;
let ctrlHeld = false;
const flyForward = new THREE.Vector3();
const flyRight = new THREE.Vector3();
const flyUp = new THREE.Vector3();
const flyMoveDir = new THREE.Vector3();
const tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
const rollState = { left:false, right:false };
let rollVelocity = 0;
let downsampleRatio = 1;
let colorMode = "source";
let backgroundTheme = "light";
let uiTheme = "sea";
let customBackgroundColor = "#e5e6f1";
let normalizeFrames = true;
let normalizationScale = null; // derived from first normalized frame
let normalizationCenter = null; // derived from first normalized frame
let currentStats = {
    frame: 0,
    points: 0,
    downsample: 1,
    colorMode: "source",
    fov: 60,
    position: { x: 0, y: 0, z: 3 },
    yaw: 0,
    pitch: 0,
    loadMs: null,
    parseMs: null,
    fetchMs: null,
    renderMs: null,
    applyMs: null,
    memory: null
};
let subtitles = [];
let currentSubtitleIndex = -1;
let subtitleFPS = 30;
let subtitlePosition = "bottom";
let subtitleColor = "#f5f7fb";
let subtitleSize = 18;


// ============================================================
// PLY LOADER (UVG compatible)
// ============================================================
async function loadFrameData(idx) {
    const start = performance.now();
    let buf;
    let fetchMs = 0;

    if (localSequence) {
        const file = localSequence.filesByIndex?.get(idx);
        if (!file) throw new Error("Missing local frame " + idx);
        const readStart = performance.now();
        buf = await file.arrayBuffer();
        fetchMs = performance.now() - readStart;
    } else {
        const url = basePath + pad(idx) + ".ply";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed " + url);

        fetchMs = performance.now() - start;
        buf = await res.arrayBuffer();
    }

    const decodeMs = performance.now() - start - fetchMs;
    const frame = await parsePLY(buf);
    const parseMs = frame.parseMs ?? null;
    const totalMs = performance.now() - start;

    return { frame, timings: { fetchMs, decodeMs, parseMs, totalMs } };
}

// ============================================================
// FAST ASCII PLY PARSER (offloaded to workers)
// ============================================================
function initWorkers() {
    const target = Math.min(WORKER_POOL_LIMIT, maxConcurrency);
    if (workerPool.length >= target) return;
    const toCreate = target - workerPool.length;
    for (let i = 0; i < toCreate; i++) {
        const worker = new Worker("js/plyWorker.js");
        worker.onmessage = (e) => {
            const { id, error, frame } = e.data;
            const pending = pendingParses.get(id);
            if (!pending) return;
            pendingParses.delete(id);
            if (error) pending.reject(new Error(error));
            else pending.resolve(frame);
        };
        worker.onerror = (err) => {
            console.error("PLY worker error", err);
        };
        workerPool.push(worker);
    }
}

function parsePLY(buffer) {
    initWorkers();
    const id = nextTaskId++;
    return new Promise((resolve, reject) => {
        pendingParses.set(id, { resolve, reject });
        const worker = workerPool[workerCursor % workerPool.length];
        workerCursor++;
        worker.postMessage({ id, buffer }, [buffer]);
    });
}


// ============================================================
// SCENE SETUP
// ============================================================
function initScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.01, 1000
    );
    camera.position.set(0, 0, 3);

    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setClearColor(0x000000, 0); // transparent to let CSS backgrounds show
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 20;
    controls.target.set(0, 0, 0);
    controls.update();

    yaw = camera.rotation.y;
    pitch = camera.rotation.x;

    geometry = new THREE.BufferGeometry();
    material = new THREE.PointsMaterial({
        size: parseFloat(pointSizeSlider.value),
        vertexColors: true
    });

    pointcloud = new THREE.Points(geometry, material);
    scene.add(pointcloud);

    createFloor();
    setFloorVisible(floorVisible);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        controls?.update();
    });

    setupPointerLockNavigation();
}


// ============================================================
// STREAMING / BUFFERED LOADING
// ============================================================
function startStreamingIfNeeded() {
    if (hasStartedStreaming) return;
    hasStartedStreaming = true;
    buffering = true;
    enqueueFrame(Math.floor(currentFrame));
    ensureBufferAroundFrame(currentFrame);
    updateLoaderUI();
}

function updateLoaderUI() {
    const pctNum = (framesLoaded / totalFrames) * 100;
    const pct = pctNum.toFixed(1);
    loaderBar.style.width = `${pctNum}%`;
    if (bufferPill) bufferPill.textContent = `Buffer ${Math.min(100, Math.max(0, pctNum)).toFixed(0)}%`;

    if (!hasStartedStreaming) {
        loaderDiv.style.display = "none";
        loaderText.textContent = "Press Play to start";
    } else if (!readyToPlay) {
        loaderDiv.style.display = "block";
        loaderText.textContent = `Buffering ${framesLoaded}/${totalFrames}`;
    } else {
        loaderDiv.style.display = "none";
        loaderText.textContent = fullyLoaded
            ? "All frames buffered"
            : `Buffered ${framesLoaded}/${totalFrames}`;
    }

    updateSliderFill();
}

function enqueueFrame(idx) {
    if (idx < 0 || idx >= totalFrames) return;
    if (frameCache.has(idx) || loading.has(idx) || loadQueue.includes(idx)) return;
    loadQueue.push(idx);
    processQueue();
}

function processQueue() {
    const allowed = Math.max(1, Math.min(maxConcurrency, WORKER_POOL_LIMIT));
    while (activeInFlight < allowed && loadQueue.length > 0) {
        const idx = loadQueue.shift();
        loading.add(idx);
        activeInFlight++;
        const token = sequenceVersion;

        loadFrameData(idx)
            .then(({ frame, timings }) => {
                if (token !== sequenceVersion) return;
                frameCache.set(idx, { ...frame, timings });
                framesLoaded++;
                if (framesLoaded === totalFrames) fullyLoaded = true;
                maybeMarkReady();
                updateLoaderUI();
            })
            .catch((err) => {
                console.error("Frame load error", idx, err);
            })
            .finally(() => {
                loading.delete(idx);
                if (token === sequenceVersion) {
                    activeInFlight = Math.max(0, activeInFlight - 1);
                    processQueue();
                }
            });
    }
}

function ensureBufferAroundFrame(centerIdx) {
    const current = Math.floor(centerIdx);
    const start = Math.max(0, current - keepBehind);
    const end   = Math.min(totalFrames - 1, current + prefetchAhead);

    for (let i = start; i <= end; i++) enqueueFrame(i);
    pruneCache(current);
}

function pruneCache(centerIdx) {
    if (frameCache.size <= maxCache) return;

    const minKeep = Math.max(0, centerIdx - keepBehind - 2);
    const maxKeep = Math.min(totalFrames - 1, centerIdx + prefetchAhead + 10);

    for (let key of frameCache.keys()) {
        if (frameCache.size <= maxCache) break;
        if (key < minKeep || key > maxKeep) frameCache.delete(key);
    }
}

function resetPlayback() {
    sequenceVersion++;
    setPlayState(false);
    loadQueue = [];
    loading.clear();
    frameCache.clear();
    framesLoaded = 0;
    fullyLoaded = false;
    readyToPlay = false;
    buffering = false;
    hasStartedStreaming = false;
    activeInFlight = 0;
    normalizationScale = null;
    normalizationCenter = null;
    currentFrame = 0;
    slider.max = Math.max(0, totalFrames - 1);
    slider.value = 0;
    currentSubtitleIndex = -1;
    updateFrameLabelText(0);
    updateSliderFill();
    updateLoaderUI();
    updatePlaybackStatus();
    updateSubtitleOverlay(0);
    updateDevInfoOverlay();
}

function maybeMarkReady() {
    if (!hasStartedStreaming) return;
    if (!readyToPlay && frameCache.size >= startBuffer) {
        readyToPlay = true;
        buffering = false;
        applyFrame(Math.floor(currentFrame));
        updateLoaderUI();
        updatePlaybackStatus();
    }
}


// ============================================================
// UI HELPERS
// ============================================================
function updateSliderFill() {
    const playedPct = (Math.floor(currentFrame) / Math.max(1, totalFrames - 1)) * 100;
    const bufferedPct = (framesLoaded / Math.max(1, totalFrames)) * 100;
    const clampedBuffered = Math.min(100, Math.max(0, bufferedPct));

    slider.style.background = `
        linear-gradient(
            90deg,
            var(--accent) 0%,
            var(--accent) ${playedPct}%,
            rgba(255,255,255,0.16) ${playedPct}%,
            rgba(255,255,255,0.16) ${clampedBuffered}%,
            rgba(255,255,255,0.08) ${clampedBuffered}%,
            rgba(255,255,255,0.08) 100%
        )
    `;
}

function updateFrameLabelText(idx) {
    const padded = String(idx).padStart(Math.max(3, padLength), "0");
    frameLabel.textContent = `Frame ${padded} / ${totalFrames-1}`;
}

function setPlayState(playing) {
    if (playing) {
        startStreamingIfNeeded();
        buffering = !readyToPlay;
    }
    isPlaying = playing;
    playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
    updatePlaybackStatus();
}

function updateLoopButton() {
    loopBtn.textContent = loopEnabled ? "🔁 Loop: ON" : "🔁 Loop: OFF";
}

function updateSpeedBadge() {
    speedBadge.textContent = `Speed ${speedFactor}x`;
}

function updatePlaybackStatus() {
    if (!statusPill) return;
    if (!hasStartedStreaming) {
        statusPill.textContent = "Idle";
        statusPill.dataset.kind = "paused";
    } else if (!readyToPlay || buffering) {
        statusPill.textContent = "Buffering…";
        statusPill.dataset.kind = "buffering";
    } else if (isPlaying) {
        statusPill.textContent = `Playing ${speedFactor}x`;
        statusPill.dataset.kind = "playing";
    } else {
        statusPill.textContent = "Paused";
        statusPill.dataset.kind = "paused";
    }
}

function updateViewModeUI() {
    const label = viewMode === ViewModes.ORBIT
        ? "Mode: Orbit (object)"
        : "Mode: Explore (WASD/QE)";
    if (viewModeToggle) viewModeToggle.textContent = label;
    if (viewModeBadge) {
        viewModeBadge.textContent = label;
        viewModeBadge.dataset.mode = viewMode;
    }
}

function updateAdvancedLabels() {
    if (flyBaseSpeedValue) flyBaseSpeedValue.textContent = flyBaseSpeed.toFixed(1);
    if (flyBoostMultValue) flyBoostMultValue.textContent = `${flyBoostMult.toFixed(1)}x`;
    if (flySlowMultValue) flySlowMultValue.textContent = `${flySlowMult.toFixed(2)}x`;
    if (lookSensitivityValue) lookSensitivityValue.textContent = (lookSensitivity * 1000).toFixed(1);

    if (startBufferValue) startBufferValue.textContent = `${startBuffer} f`;
    if (prefetchAheadValue) prefetchAheadValue.textContent = `${prefetchAhead} f`;
    if (keepBehindValue) keepBehindValue.textContent = `${keepBehind} f`;
    if (maxCacheValue) maxCacheValue.textContent = `${maxCache}`;
    if (maxConcurrencyValue) maxConcurrencyValue.textContent = `${maxConcurrency}`;

    if (downsampleValue) downsampleValue.textContent = `${Math.round(downsampleRatio * 100)}%`;
    if (totalFramesValue) totalFramesValue.textContent = `${totalFrames}`;
    if (padLengthValue) padLengthValue.textContent = `${padLength}`;
    if (subtitleFpsValue) subtitleFpsValue.textContent = `${subtitleFPS}`;
    if (subtitleSizeValue) subtitleSizeValue.textContent = `${subtitleSize}px`;
}

function createLocalSequenceFromFiles(files) {
    if (!files?.length) return null;
    const plyFiles = files.filter((f) => f.name.toLowerCase().endsWith(".ply"));
    if (!plyFiles.length) return null;

    plyFiles.sort((a, b) => {
        const pa = a._relativePath || a.webkitRelativePath || a.name;
        const pb = b._relativePath || b.webkitRelativePath || b.name;
        return pa.localeCompare(pb, undefined, { numeric: true, sensitivity: "base" });
    });

    const first = plyFiles[0];
    const rel = first._relativePath || first.webkitRelativePath || first.name;
    const lastSlash = rel.lastIndexOf("/");
    const dir = lastSlash !== -1 ? rel.slice(0, lastSlash + 1) : "";
    const fileName = lastSlash !== -1 ? rel.slice(lastSlash + 1) : rel;
    const nameNoExt = fileName.replace(/\.ply$/i, "");
    const matchDigits = nameNoExt.match(/(\d+)$/);
    const detectedPad = matchDigits ? matchDigits[1].length : 4;
    const prefix = matchDigits ? nameNoExt.slice(0, -matchDigits[1].length) : nameNoExt;
    const base = dir + prefix;

    const filesByIndex = new Map();
    plyFiles.forEach((file, idx) => filesByIndex.set(idx, file));

    return {
        filesByIndex,
        basePathLabel: base,
        pad: detectedPad,
        totalFrames: plyFiles.length
    };
}

async function promptForLocalFolderFiles() {
    if (!window.showDirectoryPicker) return null;
    try {
        const handle = await window.showDirectoryPicker();
        const files = [];
        const walk = async (dirHandle, prefix = "") => {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".ply")) {
                    const file = await entry.getFile();
                    file._relativePath = prefix + entry.name;
                    files.push(file);
                } else if (entry.kind === "directory") {
                    await walk(entry, `${prefix}${entry.name}/`);
                }
            }
        };
        await walk(handle);
        return files;
    } catch (err) {
        if (err?.name === "AbortError") return [];
        console.warn("Directory picker unavailable", err);
        return null;
    }
}

function applyVideoSource(id, base, frames, pad, options = {}) {
    if (options.localSequence !== undefined) {
        localSequence = options.localSequence;
    }
    currentSequenceId = id || "custom";
    basePath = base || basePath;
    totalFrames = Math.max(1, parseInt(frames ?? totalFrames, 10) || totalFrames);
    padLength = Math.max(1, parseInt(pad ?? padLength, 10) || padLength);

    if (sequenceSelect && sequenceSelect.value !== currentSequenceId) sequenceSelect.value = currentSequenceId;
    if (basePathInput) basePathInput.value = basePath;
    if (totalFramesInput) totalFramesInput.value = totalFrames;
    if (padLengthInput) padLengthInput.value = padLength;

    slider.max = Math.max(0, totalFrames - 1);
    resetPlayback();
    updateAdvancedLabels();
}

function setBackgroundTheme(mode, customColor) {
    backgroundTheme = mode;
    document.body.dataset.bg = mode;

    if (mode === "custom") {
        if (customColor) customBackgroundColor = customColor;
        document.body.style.background = customBackgroundColor;
    } else {
        const bg = getComputedStyle(document.body).getPropertyValue("--bg");
        const resolved = bg?.trim();
        document.body.style.background = resolved || "rgb(229, 230, 241)";
    }
}

function setUITheme(mode) {
    uiTheme = mode;
    document.body.dataset.uiTheme = mode;
}

function toggleAdvancedPanel(force) {
    if (!advancedPanel) return;
    const open = force !== undefined ? force : !advancedPanel.classList.contains("open");
    advancedPanel.classList.toggle("open", open);
    if (advancedToggle) {
        advancedToggle.textContent = open ? "✨ Hide advanced" : "✨ Show advanced";
    }
}

function updateDevInfoOverlay() {
    if (!devInfoBox) return;
    const enabled = devInfoToggle?.checked;
    devInfoBox.style.display = enabled ? "block" : "none";
    if (!enabled) return;

    if (performance && performance.memory) {
        const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
        currentStats.memory = {
            usedMB: usedJSHeapSize / (1024 * 1024),
            totalMB: totalJSHeapSize / (1024 * 1024)
        };
    } else {
        currentStats.memory = null;
    }

    const pos = camera?.position || { x:0, y:0, z:0 };
    const yawDeg = THREE.Math.radToDeg(yaw);
    const pitchDeg = THREE.Math.radToDeg(pitch);
    const speedBase = flyBaseSpeed * flyWheelScalar;
    const speedActual = speedBase * (shiftHeld ? flyBoostMult : (ctrlHeld ? flySlowMult : 1));
    const lines = [
        ["Points", currentStats.points.toLocaleString()],
        ["Frame", `${Math.floor(currentStats.frame)} / ${totalFrames - 1}`],
        ["Pos", `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`],
        ["Look", `${yawDeg.toFixed(1)}°, ${pitchDeg.toFixed(1)}°`],
        ["Speed", `${speedActual.toFixed(2)} (wheel ${flyWheelScalar.toFixed(2)}x)`],
        ["Downsample", `${Math.round(currentStats.downsample * 100)}%`],
        ["Colors", currentStats.colorMode],
        ["Load", currentStats.loadMs != null
            ? `${currentStats.loadMs.toFixed(1)} ms (fetch ${currentStats.fetchMs?.toFixed(1) ?? "?"}, parse ${currentStats.parseMs?.toFixed(1) ?? "?"})`
            : "n/a"],
        ["Render", currentStats.renderMs != null ? `${currentStats.renderMs.toFixed(2)} ms` : "n/a"],
        ["Apply", currentStats.applyMs != null ? `${currentStats.applyMs.toFixed(2)} ms` : "n/a"],
        ["RAM", currentStats.memory ? `${currentStats.memory.usedMB.toFixed(1)} / ${currentStats.memory.totalMB.toFixed(1)} MB` : "n/a"]
    ];

    devInfoBox.innerHTML = lines.map(
        ([label, value]) =>
            `<div class="line"><span class="label">${label}</span><span class="value">${value}</span></div>`
    ).join("");
}

function parseTimecode(tc) {
    if (!tc) return NaN;
    const cleaned = tc.trim().replace(",", ".");
    const parts = cleaned.split(":").map(parseFloat);
    if (parts.length < 3) return NaN;
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
}

function parseSubtitles(text) {
    if (!text) return [];
    const cues = [];
    const regex = /(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)[^\n]*\n([\s\S]*?)(?=\n{2,}|\r?\n\r?\n|$)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const start = parseTimecode(match[1]);
        const end = parseTimecode(match[2]);
        if (Number.isNaN(start) || Number.isNaN(end)) continue;
        const body = match[3].trim().replace(/\r/g, "");
        cues.push({ start, end, text: body.replace(/\n/g, "<br>") });
    }
    cues.sort((a, b) => a.start - b.start);
    return cues;
}

function updateSubtitleOverlay(currentSeconds) {
    if (!subtitlesDiv) return;
    if (!subtitles.length) {
        subtitlesDiv.style.display = "none";
        return;
    }

    const inActive = currentSubtitleIndex >= 0 && currentSubtitleIndex < subtitles.length
        ? subtitles[currentSubtitleIndex]
        : null;

    if (!inActive || currentSeconds < inActive.start || currentSeconds > inActive.end) {
        currentSubtitleIndex = subtitles.findIndex(
            (s) => currentSeconds >= s.start && currentSeconds <= s.end
        );
    }

    if (currentSubtitleIndex === -1) {
        subtitlesDiv.style.display = "none";
        return;
    }

    const cue = subtitles[currentSubtitleIndex];
    subtitlesDiv.innerHTML = cue.text;
    subtitlesDiv.style.display = "block";
    subtitlesDiv.style.color = subtitleColor;
    subtitlesDiv.style.fontSize = `${subtitleSize}px`;
    subtitlesDiv.style.bottom = subtitlePosition === "bottom" ? "12%" : "auto";
    subtitlesDiv.style.top = subtitlePosition === "top" ? "12%" : "auto";
}

function resetFlyMotion() {
    flyVelocity.set(0, 0, 0);
    flyMoveState.forward = flyMoveState.backward = false;
    flyMoveState.left = flyMoveState.right = false;
    flyMoveState.up = flyMoveState.down = false;
    shiftHeld = false;
    ctrlHeld = false;
    roll = 0;
    rollVelocity = 0;
    rollState.left = rollState.right = false;
}

function updateCameraOrientation() {
    if (!camera) return;
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = roll;
}

function setViewMode(mode) {
    if (mode === viewMode) return;
    viewMode = mode;

    if (viewMode === ViewModes.FLY) {
        controls.enabled = false;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        yaw = Math.atan2(dir.x, -dir.z);
        pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
        roll = 0;
        resetFlyMotion();
        updateCameraOrientation();
    } else {
        document.exitPointerLock?.();
        resetFlyMotion();
        roll = 0;
        controls.enabled = true;
        controls.target.set(0, 0, 0);
        camera.lookAt(controls.target);
        controls.update();
    }
    updateViewModeUI();
}

function setupPointerLockNavigation() {
    const canvas = renderer.domElement;
    canvas.addEventListener("click", () => {
        if (viewMode !== ViewModes.FLY || pointerLocked) return;
        canvas.requestPointerLock?.();
    });

    document.addEventListener("pointerlockchange", () => {
        pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener("mousemove", (e) => {
        if (viewMode !== ViewModes.FLY || !pointerLocked) return;
        const dx = e.movementX;
        const dy = e.movementY;

        // Rotate around camera-local up/right so mouse stays screen-correct even when rolled.
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        const upVec    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

        const qYaw   = new THREE.Quaternion().setFromAxisAngle(upVec, -dx * lookSensitivity);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(rightVec, -dy * lookSensitivity);

        camera.quaternion.premultiply(qYaw);
        camera.quaternion.premultiply(qPitch);

        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        yaw = euler.y;
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x));
        roll = euler.z;

        // Reapply clamped pitch to the quaternion to avoid drift.
        tmpEuler.set(pitch, yaw, roll, "YXZ");
        camera.quaternion.setFromEuler(tmpEuler);
        updateCameraOrientation();
    });
}

function createFloor() {
    const size = 12;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x1b222b,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
    });
    floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.6;
    floor.receiveShadow = false;
    scene.add(floor);
}

function getFloorY() {
    return floor?.position?.y ?? -0.6;
}

function setFloorVisible(flag) {
    floorVisible = flag;
    if (floor) floor.visible = flag;
}

function applyRotationFromInputs() {
    if (!pointcloud) return;
    pointcloud.rotation.set(0, 0, 0);
}

function resetView() {
    if (!material || !camera || !pointcloud) return;

    pointSizeSlider.value = DEFAULT_POINT_SIZE;
    material.size = DEFAULT_POINT_SIZE;
    pointSizeValue.textContent = DEFAULT_POINT_SIZE.toFixed(3);
    applyRotationFromInputs();

    if (viewMode === ViewModes.FLY) {
        document.exitPointerLock?.();
        resetFlyMotion();
        flyWheelScalar = 1;
        camera.position.set(0, 0, 3);
        yaw = 0;
        pitch = 0;
        roll = 0;
        updateCameraOrientation();
    } else if (controls) {
        controls.target.set(0, 0, 0);
        camera.position.set(0, 0, 3);
        controls.update();
    } else {
        camera.position.set(0, 0, 3);
    }
}

function seekToFrame(idx, { pause=false } = {}) {
    if (!readyToPlay) return;

    const clamped = Math.max(0, Math.min(totalFrames - 1, idx));
    if (pause) setPlayState(false);

    currentFrame = clamped;
    slider.value = clamped;
    updateFrameLabelText(Math.floor(clamped));
    ensureBufferAroundFrame(clamped);

    const applied = applyFrame(clamped);
    buffering = !applied;
    updateLoaderUI();
    updatePlaybackStatus();
    updateDevInfoOverlay();
}

function reapplyCurrentFrame() {
    if (!readyToPlay) return;
    applyFrame(Math.floor(currentFrame));
    updateDevInfoOverlay();
}

function initializeUIState() {
    slider.max = totalFrames - 1;
    slider.value = currentFrame;
    updateFrameLabelText(Math.floor(currentFrame));

    speedSelect.value = speedFactor.toString();
    updateSpeedBadge();
    updateLoopButton();

    pointSizeValue.textContent = parseFloat(pointSizeSlider.value).toFixed(3);
    updateSliderFill();
    updatePlaybackStatus();
    updateViewModeUI();
    if (sequenceSelect) sequenceSelect.value = currentSequenceId;
    if (basePathInput) basePathInput.value = basePath;
    if (totalFramesInput) totalFramesInput.value = totalFrames;
    if (padLengthInput) padLengthInput.value = padLength;
    if (subtitleFpsInput) subtitleFpsInput.value = subtitleFPS;
    if (subtitlePositionSelect) subtitlePositionSelect.value = subtitlePosition;
    if (subtitleColorInput) subtitleColorInput.value = subtitleColor;
    if (subtitleSizeInput) subtitleSizeInput.value = subtitleSize;
    if (normalizeToggle) normalizeToggle.checked = normalizeFrames;
    if (flyBaseSpeedInput) flyBaseSpeedInput.value = flyBaseSpeed;
    if (flyBoostMultInput) flyBoostMultInput.value = flyBoostMult;
    if (flySlowMultInput)  flySlowMultInput.value = flySlowMult;
    if (lookSensitivityInput) lookSensitivityInput.value = (lookSensitivity * 1000).toFixed(1);

    if (startBufferInput) startBufferInput.value = startBuffer;
    if (prefetchAheadInput) prefetchAheadInput.value = prefetchAhead;
    if (keepBehindInput) keepBehindInput.value = keepBehind;
    if (maxCacheInput) maxCacheInput.value = maxCache;
    if (maxConcurrencyInput) maxConcurrencyInput.value = maxConcurrency;

    if (colorModeSelect) colorModeSelect.value = colorMode;
    if (downsampleInput) downsampleInput.value = downsampleRatio;
    if (backgroundThemeSelect) backgroundThemeSelect.value = backgroundTheme;
    if (uiThemeSelect) uiThemeSelect.value = uiTheme;
    if (floorToggle) floorToggle.checked = floorVisible;
    if (backgroundColorInput) backgroundColorInput.value = customBackgroundColor;

    setBackgroundTheme(backgroundTheme, customBackgroundColor);
    setUITheme(uiTheme);
    updateAdvancedLabels();
    toggleAdvancedPanel(false);
    if (devInfoToggle) devInfoToggle.checked = false;
    updateDevInfoOverlay();
    normalizationScale = null;
}


// ============================================================
// APPLY FRAME (center + scale + apply rotation)
// ============================================================
function selectSampleIndices(count) {
    if (downsampleRatio >= 0.999) return null;
    const target = Math.max(1, Math.floor(count * downsampleRatio));
    const stride = Math.max(1, Math.floor(count / target));
    const indices = [];
    for (let i = 0; i < count; i += stride) indices.push(i);
    return indices;
}

function buildColorAttribute(frame, sampleIndices) {
    const src = frame.colors;
    const normalizedSrc = src.BYTES_PER_ELEMENT === 1;
    const sampleCount = sampleIndices ? sampleIndices.length : frame.vertexCount;

    // Fast path: full sample + source colors unchanged
    if (!sampleIndices && colorMode === "source") {
        return new THREE.BufferAttribute(src, 3, normalizedSrc);
    }

    const useSourceType = colorMode === "source";
    const arr = useSourceType
        ? new (src.constructor)(sampleCount * 3)
        : new Float32Array(sampleCount * 3);
    const normalized = useSourceType ? normalizedSrc : false;
    const factor = normalizedSrc ? 1 / 255 : 1;

    let cursor = 0;
    const writeColor = (r, g, b) => {
        arr[3 * cursor] = r;
        arr[3 * cursor + 1] = g;
        arr[3 * cursor + 2] = b;
        cursor++;
    };

    const iter = sampleIndices || { length: frame.vertexCount };
    const iterate = sampleIndices
        ? (fn) => sampleIndices.forEach(fn)
        : (fn) => { for (let i = 0; i < iter.length; i++) fn(i); };

    iterate((idx) => {
        const r = src[3 * idx] * factor;
        const g = src[3 * idx + 1] * factor;
        const b = src[3 * idx + 2] * factor;

        if (colorMode === "greyscale") {
            const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            writeColor(l, l, l);
        } else if (colorMode === "mono") {
            writeColor(1, 1, 1);
        } else {
            if (useSourceType && normalizedSrc) {
                writeColor(r * 255, g * 255, b * 255);
            } else if (useSourceType) {
                writeColor(r, g, b);
            } else {
                writeColor(r, g, b);
            }
        }
    });

    return new THREE.BufferAttribute(arr, 3, normalized);
}

function applyFrame(idx) {
    const f = frameCache.get(idx);
    if (!f) {
        enqueueFrame(idx); // request it if missing
        return false;
    }

    const applyStart = performance.now();
    const timings = f.timings || {};
    const N = f.vertexCount;
    const src = f.positions;

    let cx = 0, cy = 0, cz = 0, scale = 1;
    if (normalizeFrames) {
        if (!normalizationCenter || normalizationScale == null) {
            let minX=1e9, maxX=-1e9;
            let minY=1e9, maxY=-1e9;
            let minZ=1e9, maxZ=-1e9;

            for (let i = 0; i < N; i++) {
                const x = src[3*i];
                const y = src[3*i+1];
                const z = src[3*i+2];

                if (x<minX) minX=x; if (x>maxX) maxX=x;
                if (y<minY) minY=y; if (y>maxY) maxY=y;
                if (z<minZ) minZ=z; if (z>maxZ) maxZ=z;
            }

            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;
            cz = (minZ + maxZ) / 2;
            const extent = Math.max(1e-6, Math.max(maxX-minX, maxY-minY, maxZ-minZ));
            normalizationScale = 2.0 / extent;
            normalizationCenter = { cx, cy, cz };
        }
        cx = normalizationCenter.cx;
        cy = normalizationCenter.cy;
        cz = normalizationCenter.cz;
        scale = normalizationScale;
    }

    const samples = selectSampleIndices(N);
    const sampleCount = samples ? samples.length : N;
    const centered = new Float32Array(sampleCount * 3);
    let minYPost = Infinity;

    if (samples) {
        let cursor = 0;
        for (let idx of samples) {
            centered[3*cursor]   = (src[3*idx]   - cx) * scale;
            centered[3*cursor+1] = (src[3*idx+1] - cy) * scale;
            centered[3*cursor+2] = (src[3*idx+2] - cz) * scale;
            if (centered[3*cursor+1] < minYPost) minYPost = centered[3*cursor+1];
            cursor++;
        }
    } else {
        for (let i = 0; i < N; i++) {
            centered[3*i]   = (src[3*i]   - cx) * scale;
            centered[3*i+1] = (src[3*i+1] - cy) * scale;
            centered[3*i+2] = (src[3*i+2] - cz) * scale;
            if (centered[3*i+1] < minYPost) minYPost = centered[3*i+1];
        }
    }

    const floorY = getFloorY();
    if (normalizeFrames && Number.isFinite(minYPost) && minYPost < floorY) {
        const lift = floorY - minYPost;
        for (let i = 0; i < centered.length; i += 3) {
            centered[i + 1] += lift;
        }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(centered, 3));
    geometry.setAttribute("color", buildColorAttribute(f, samples));
    geometry.computeBoundingSphere();

    // Apply rotation from sliders
    applyRotationFromInputs();

    currentStats.points = sampleCount;
    currentStats.frame = idx;
    currentStats.downsample = downsampleRatio;
    currentStats.colorMode = colorMode;
    currentStats.fov = camera?.fov ?? currentStats.fov;
    currentStats.position = camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : currentStats.position;
    currentStats.yaw = yaw;
    currentStats.pitch = pitch;
    currentStats.speedScalar = flyWheelScalar;
    currentStats.applyMs = performance.now() - applyStart;
    const loadMs = timings.totalMs ?? null;
    const parseMs = timings.parseMs ?? f.parseMs ?? null;
    const fetchMs = timings.fetchMs ?? null;
    currentStats.loadMs = loadMs != null ? loadMs : currentStats.loadMs;
    currentStats.parseMs = parseMs != null ? parseMs : currentStats.parseMs;
    currentStats.fetchMs = fetchMs != null ? fetchMs : currentStats.fetchMs;

    updateFrameLabelText(idx);
    return true;
}


// ============================================================
// ANIMATION LOOP
// ============================================================
function updateFlyMovement(delta) {
    if (!camera) return;

    // Integrate roll first so orientation vectors use the latest roll.
    let rollInput = 0;
    if (rollState.left) rollInput -= 1;
    if (rollState.right) rollInput += 1;
    rollVelocity += rollInput * (DEFAULT_FLY.rollSpeed * 0.5) * flyWheelScalar;
    rollVelocity *= Math.exp(-DEFAULT_FLY.rollDamping * delta);
    if (Math.abs(rollVelocity) < 1e-4) rollVelocity = 0;
    if (rollVelocity !== 0 || rollInput !== 0) {
        roll += rollVelocity * delta;
        updateCameraOrientation();
    }

    flyMoveDir.set(0, 0, 0);
    // Forward/right/up follow the camera's actual quaternion (includes roll).
    camera.updateMatrixWorld();
    flyForward.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    flyUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    flyRight.copy(flyForward).cross(flyUp).normalize();
    flyUp.copy(flyRight).cross(flyForward).normalize();

    if (flyMoveState.forward) flyMoveDir.add(flyForward);
    if (flyMoveState.backward) flyMoveDir.sub(flyForward);
    if (flyMoveState.left) flyMoveDir.sub(flyRight);
    if (flyMoveState.right) flyMoveDir.add(flyRight);

    const vertical = (flyMoveState.up ? 1 : 0) - (flyMoveState.down ? 1 : 0);
    if (vertical !== 0) flyMoveDir.addScaledVector(flyUp, vertical);

    if (flyMoveDir.lengthSq() > 0) flyMoveDir.normalize();

    let speedMult = flyBaseSpeed * flyWheelScalar;
    if (shiftHeld) speedMult *= flyBoostMult;
    else if (ctrlHeld) speedMult *= flySlowMult;

    const accel = flyAccel * speedMult;
    flyVelocity.addScaledVector(flyMoveDir, accel * delta);

    // Exponential damping for smooth stop
    const damping = Math.exp(-flyDamping * delta);
    flyVelocity.multiplyScalar(damping);

    // Deadzone to avoid micro drifting
    if (flyVelocity.lengthSq() < 1e-6) flyVelocity.set(0, 0, 0);

    camera.position.addScaledVector(flyVelocity, delta);
}

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min(0.1, (now - prevTime) / 1000);
    prevTime = now;

    if (readyToPlay && isPlaying) {
        const frameAdvance = playbackFPS * speedFactor * delta;
        let nextFrame = currentFrame + frameAdvance;
        if (nextFrame >= totalFrames) {
            if (loopEnabled) nextFrame = 0;
            else {
                nextFrame = totalFrames - 1;
                setPlayState(false);
            }
        }
        const idx = Math.floor(nextFrame);
        ensureBufferAroundFrame(idx);
        const applied = applyFrame(idx);
        if (applied) {
            buffering = false;
            currentFrame = nextFrame;
            slider.value = idx;
        } else {
            buffering = true;
        }
        updateLoaderUI();
    }

    updatePlaybackStatus();
    if (viewMode === ViewModes.FLY) updateFlyMovement(delta);
    if (viewMode === ViewModes.ORBIT) controls?.update();
    const renderStart = performance.now();
    renderer.render(scene, camera);
    currentStats.renderMs = performance.now() - renderStart;
    const subtitleTime = subtitleFPS > 0 ? (currentFrame / subtitleFPS) : 0;
    updateSubtitleOverlay(subtitleTime);
    updateDevInfoOverlay();
}


// ============================================================
// UI
// ============================================================
playBtn.onclick = () => {
    setPlayState(!isPlaying);
};

slider.oninput = (e) => {
    if (!readyToPlay) return;
    seekToFrame(parseInt(e.target.value), { pause:true });
};

speedSelect.onchange = (e) => {
    speedFactor = parseFloat(e.target.value);
    updateSpeedBadge();
    updatePlaybackStatus();
};

loopBtn.onclick = () => {
    loopEnabled = !loopEnabled;
    updateLoopButton();
    updatePlaybackStatus();
};

pointSizeSlider.oninput = () => {
    const size = parseFloat(pointSizeSlider.value);
    material.size = size;
    pointSizeValue.textContent = size.toFixed(3);
};

fullscreenBtn.onclick = () => {
    if (!document.fullscreenElement) document.body.requestFullscreen?.();
    else document.exitFullscreen?.();
};

viewModeToggle.onclick = () => {
    const next = viewMode === ViewModes.ORBIT ? ViewModes.FLY : ViewModes.ORBIT;
    setViewMode(next);
};

advancedToggle.onclick = () => toggleAdvancedPanel();

flyBaseSpeedInput?.addEventListener("input", () => {
    flyBaseSpeed = parseFloat(flyBaseSpeedInput.value);
    updateAdvancedLabels();
});
flyBoostMultInput?.addEventListener("input", () => {
    flyBoostMult = parseFloat(flyBoostMultInput.value);
    updateAdvancedLabels();
});
flySlowMultInput?.addEventListener("input", () => {
    flySlowMult = parseFloat(flySlowMultInput.value);
    updateAdvancedLabels();
});
lookSensitivityInput?.addEventListener("input", () => {
    lookSensitivity = parseFloat(lookSensitivityInput.value) / 1000;
    updateAdvancedLabels();
});

startBufferInput?.addEventListener("input", () => {
    startBuffer = parseInt(startBufferInput.value, 10);
    updateAdvancedLabels();
    maybeMarkReady();
});
prefetchAheadInput?.addEventListener("input", () => {
    prefetchAhead = parseInt(prefetchAheadInput.value, 10);
    updateAdvancedLabels();
    ensureBufferAroundFrame(Math.floor(currentFrame));
});
keepBehindInput?.addEventListener("input", () => {
    keepBehind = parseInt(keepBehindInput.value, 10);
    updateAdvancedLabels();
    pruneCache(Math.floor(currentFrame));
});
maxCacheInput?.addEventListener("input", () => {
    maxCache = parseInt(maxCacheInput.value, 10);
    updateAdvancedLabels();
    pruneCache(Math.floor(currentFrame));
});
maxConcurrencyInput?.addEventListener("input", () => {
    maxConcurrency = parseInt(maxConcurrencyInput.value, 10);
    maxConcurrency = Math.max(1, Math.min(maxConcurrency, WORKER_POOL_LIMIT));
    initWorkers();
    updateAdvancedLabels();
    processQueue();
});

sequenceSelect?.addEventListener("change", () => {
    const id = sequenceSelect.value;
    const seq = sequenceMap[id];
    if (seq) {
        applyVideoSource(seq.id, seq.basePath, seq.totalFrames, seq.pad, { localSequence: null });
    }
});

basePathInput?.addEventListener("change", () => {
    applyVideoSource("custom", basePathInput.value, totalFramesInput?.value, padLengthInput?.value, { localSequence: null });
});
totalFramesInput?.addEventListener("change", () => {
    applyVideoSource("custom", basePathInput?.value, totalFramesInput.value, padLengthInput?.value);
});
padLengthInput?.addEventListener("change", () => {
    applyVideoSource("custom", basePathInput?.value, totalFramesInput?.value, padLengthInput.value);
});

resetVideoBtn?.addEventListener("click", () => {
    resetPlayback();
});

selectFolderBtn?.addEventListener("click", async () => {
    const pickedFiles = await promptForLocalFolderFiles();
    if (pickedFiles?.length) {
        const seq = createLocalSequenceFromFiles(pickedFiles);
        if (seq) {
            applyVideoSource("custom", seq.basePathLabel, seq.totalFrames, seq.pad, { localSequence: seq });
            return;
        }
    }
    if (pickedFiles === null) {
        sequenceFolderInput?.click();
    }
});

sequenceFolderInput?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    const seq = createLocalSequenceFromFiles(files);
    if (!seq) return;
    applyVideoSource("custom", seq.basePathLabel, seq.totalFrames, seq.pad, { localSequence: seq });
    sequenceFolderInput.value = "";
});

colorModeSelect?.addEventListener("change", () => {
    colorMode = colorModeSelect.value;
    reapplyCurrentFrame();
});

downsampleInput?.addEventListener("input", () => {
    downsampleRatio = parseFloat(downsampleInput.value);
    updateAdvancedLabels();
    reapplyCurrentFrame();
});

backgroundThemeSelect?.addEventListener("change", () => {
    const mode = backgroundThemeSelect.value;
    if (mode === "custom") {
        setBackgroundTheme(mode, customBackgroundColor);
    } else {
        setBackgroundTheme(mode);
    }
});

uiThemeSelect?.addEventListener("change", () => {
    setUITheme(uiThemeSelect.value);
});

devInfoToggle?.addEventListener("change", () => {
    updateDevInfoOverlay();
});

subtitleFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const text = reader.result?.toString() || "";
        subtitles = parseSubtitles(text);
        currentSubtitleIndex = -1;
        updateSubtitleOverlay(0);
    };
    reader.readAsText(file);
});

subtitleFpsInput?.addEventListener("input", () => {
    const val = parseFloat(subtitleFpsInput.value);
    if (!Number.isNaN(val) && val > 0) {
        subtitleFPS = val;
        updateAdvancedLabels();
    }
});

subtitlePositionSelect?.addEventListener("change", () => {
    subtitlePosition = subtitlePositionSelect.value;
    updateSubtitleOverlay(subtitleFPS > 0 ? currentFrame / subtitleFPS : 0);
});

subtitleColorInput?.addEventListener("input", () => {
    subtitleColor = subtitleColorInput.value;
    updateSubtitleOverlay(subtitleFPS > 0 ? currentFrame / subtitleFPS : 0);
});

subtitleSizeInput?.addEventListener("input", () => {
    subtitleSize = parseInt(subtitleSizeInput.value, 10);
    updateAdvancedLabels();
    updateSubtitleOverlay(subtitleFPS > 0 ? currentFrame / subtitleFPS : 0);
});

normalizeToggle?.addEventListener("change", () => {
    normalizeFrames = normalizeToggle.checked;
    normalizationScale = null; // recompute on next frame when enabled
    normalizationCenter = null;
    reapplyCurrentFrame();
});

floorToggle?.addEventListener("change", (e) => {
    setFloorVisible(e.target.checked);
});

backgroundColorInput?.addEventListener("input", (e) => {
    customBackgroundColor = e.target.value || customBackgroundColor;
    if (backgroundThemeSelect) backgroundThemeSelect.value = "custom";
    setBackgroundTheme("custom", customBackgroundColor);
});

document.addEventListener("mousedown", (e) => {
    if (!advancedPanel?.classList.contains("open")) return;
    if (advancedPanel.contains(e.target)) return;
    if (e.target === advancedToggle) return;
    toggleAdvancedPanel(false);
});

document.addEventListener("pointerdown", (e) => {
    if (!advancedPanel?.classList.contains("open")) return;
    if (advancedPanel.contains(e.target)) return;
    if (e.target === advancedToggle) return;
    toggleAdvancedPanel(false);
}, true);

window.addEventListener("wheel", (e) => {
    if (advancedPanel?.classList.contains("open") && advancedPanel.contains(e.target)) {
        return; // allow native scroll inside advanced menu
    }
    if (viewMode !== ViewModes.FLY) return;
    if (typeof e.deltaY !== "number") return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    flyWheelScalar = Math.min(5, Math.max(0.2, flyWheelScalar * factor));
    updateDevInfoOverlay();
}, { passive: false });

resetViewBtn.onclick = () => resetView();

prevFrameBtn.onclick    = () => seekToFrame(Math.floor(currentFrame) - 1, { pause:false });
nextFrameBtn.onclick    = () => seekToFrame(Math.floor(currentFrame) + 1, { pause:false });
back10Btn.onclick       = () => seekToFrame(Math.floor(currentFrame) - 10, { pause:false });
forward10Btn.onclick    = () => seekToFrame(Math.floor(currentFrame) + 10, { pause:false });

window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;

    if (e.key === "Escape" && advancedPanel?.classList.contains("open")) {
        toggleAdvancedPanel(false);
        return;
    }

    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (viewMode === ViewModes.FLY) {
        const key = e.key.toLowerCase();
        if (key === "w") { flyMoveState.forward = true; }
        else if (key === "s") { flyMoveState.backward = true; }
        else if (key === "a") { flyMoveState.left = true; }
        else if (key === "d") { flyMoveState.right = true; }
        else if (key === "z") { flyMoveState.down = true; }
        else if (key === "c") { flyMoveState.up = true; }
        else if (key === "q") { rollState.right = true; }
        else if (key === "e") { rollState.left = true; }
        else if (key === "shift") { shiftHeld = true; }
        else if (key === "control") { ctrlHeld = true; }
    }

    if (e.code === "Space") {
        e.preventDefault();
        setPlayState(!isPlaying);
    } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        seekToFrame(Math.floor(currentFrame) + delta, { pause:false });
    } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        seekToFrame(Math.floor(currentFrame) - delta, { pause:false });
    } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fullscreenBtn.click();
    } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        loopEnabled = !loopEnabled;
        updateLoopButton();
        updatePlaybackStatus();
    } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetView();
    }
});

window.addEventListener("keyup", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (viewMode !== ViewModes.FLY) return;

    const key = e.key.toLowerCase();
    if (key === "w") { flyMoveState.forward = false; }
    else if (key === "s") { flyMoveState.backward = false; }
    else if (key === "a") { flyMoveState.left = false; }
    else if (key === "d") { flyMoveState.right = false; }
    else if (key === "z") { flyMoveState.down = false; }
    else if (key === "c") { flyMoveState.up = false; }
    else if (key === "q") { rollState.right = false; }
    else if (key === "e") { rollState.left = false; }
    else if (key === "shift") { shiftHeld = false; }
    else if (key === "control") { ctrlHeld = false; }
});


// ============================================================
// BOOT
// ============================================================
initScene();
initializeUIState();
updateLoaderUI();
animate();
