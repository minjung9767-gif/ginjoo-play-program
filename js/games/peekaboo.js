// 까꿍 동물 (개선판):
// - 동물이 내 얼굴 주변·화면 구석에서 "빼꼼" 나타남 → 손 터치 / 카메라 움직임으로 잡기
// - 잡으면 까르르 + 별 팡, 다른 곳에서 다시 빼꼼 (두더지잡기)
// - 얼굴을 가렸다 떼면 큰 "까꿍!" 보너스
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/vision_bundle.mjs";

import { playPeekaboo, playSparkle } from "../audio.js";
import { screenToCanvas, canvasToScreen } from "../coords.js";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const ANIMALS = ["🐻", "🐰", "🐱", "🐶", "🦁", "🐯", "🐼", "🐸", "🐵", "🐷", "🐮", "🐥", "🦄", "🐧", "🐨", "🐹"];

const GRID_W = 80;
const GRID_H = 60;
const DIFF_THRESHOLD = 110;
const HIDDEN_MS = 500; // 얼굴이 이 시간 이상 사라지면 "가린" 것
const VISIBLE_MS = 250;
const STAY_MS = 2800; // 동물이 머무는 시간
const SPAWN_MIN = 1300;
const SPAWN_MAX = 2300;

let faceLandmarker = null;
let rafId = null;
let lastVideoTime = -1;
let lastSeenAt = 0;
let everSeen = false;
let coverState = "waiting";
let lastLandmarks = null;
let peeks = [];
let score = 0;
let nextSpawnAt = 0;
let pointerHandler = null;
let layerEl = null;
let starBarEl = null;

export async function startPeekaboo(videoEl, canvasEl, onReady) {
  // 상태 초기화
  lastVideoTime = -1;
  lastSeenAt = 0;
  everSeen = false;
  coverState = "waiting";
  lastLandmarks = null;
  peeks = [];
  score = 0;
  nextSpawnAt = 0;

  const gameEl = document.getElementById("game");

  // 동물/별을 담을 레이어
  layerEl = document.createElement("div");
  layerEl.className = "peek-layer";
  gameEl.appendChild(layerEl);

  // 별 카운터
  starBarEl = document.createElement("div");
  starBarEl.className = "star-bar";
  starBarEl.textContent = "⭐ 0";
  gameEl.appendChild(starBarEl);

  // 움직임 감지용 오프스크린
  const off = document.createElement("canvas");
  off.width = GRID_W;
  off.height = GRID_H;
  const octx = off.getContext("2d", { willReadFrequently: true });
  let prev = null;

  // 모델 로딩
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  // 터치로 잡기
  pointerHandler = (e) => {
    if (e.target.closest(".ctrl-btn")) return;
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (x == null) return;
    catchAt(x, y);
  };
  gameEl.addEventListener("pointerdown", pointerHandler);

  let ready = false;
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (!faceLandmarker || !videoEl.videoWidth) return;

    const now = performance.now();

    // 얼굴 검출
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      const res = faceLandmarker.detectForVideo(videoEl, now);
      if (res.faceLandmarks && res.faceLandmarks.length > 0) {
        lastLandmarks = res.faceLandmarks[0];
        lastSeenAt = now;
        everSeen = true;
      }
    }

    // 얼굴 가림 → 보임 보너스
    const visibleNow = now - lastSeenAt < VISIBLE_MS;
    if (everSeen) {
      if (coverState === "waiting" && now - lastSeenAt > HIDDEN_MS) {
        coverState = "hidden";
      } else if (coverState === "hidden" && visibleNow) {
        coverState = "waiting";
        triggerBonus();
      }
    }

    // 새 동물 빼꼼
    if (now >= nextSpawnAt && peeks.length < 2) {
      spawnPeek(canvasEl);
      nextSpawnAt = now + SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    }

    // 카메라 움직임으로 잡기
    octx.drawImage(videoEl, 0, 0, GRID_W, GRID_H);
    const cur = octx.getImageData(0, 0, GRID_W, GRID_H).data;
    if (prev) {
      for (let i = peeks.length - 1; i >= 0; i--) {
        const p = peeks[i];
        if (p.status !== "in") continue;
        const c = screenToCanvas(p.x, p.y, canvasEl);
        const gx = Math.min(GRID_W - 1, Math.max(0, (c.x / canvasEl.width) * GRID_W)) | 0;
        const gy = Math.min(GRID_H - 1, Math.max(0, (c.y / canvasEl.height) * GRID_H)) | 0;
        const idx = (gy * GRID_W + gx) * 4;
        const d =
          Math.abs(cur[idx] - prev[idx]) +
          Math.abs(cur[idx + 1] - prev[idx + 1]) +
          Math.abs(cur[idx + 2] - prev[idx + 2]);
        if (d > DIFF_THRESHOLD) catchPeek(p);
      }
    }
    prev = cur.slice();

    // 수명 만료된 동물 숨기기
    for (let i = peeks.length - 1; i >= 0; i--) {
      const p = peeks[i];
      if (p.status === "in" && now - p.bornAt > STAY_MS) hidePeek(p);
    }

    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  }
  loop();
}

// 동물이 나타날 위치 (얼굴 주변 또는 화면 구석), 매번 다르게
function pickSpot(canvasEl) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vmin = Math.min(vw, vh);
  const m = vmin * 0.16;
  const D = vmin * 0.3;

  const corners = [
    { x: m, y: m },
    { x: vw - m, y: m },
    { x: m, y: vh - m },
    { x: vw - m, y: vh - m },
    { x: vw / 2, y: m },
    { x: vw / 2, y: vh - m },
  ];

  let candidates = corners;
  let face = null;
  if (lastLandmarks) {
    const W = canvasEl.width;
    const H = canvasEl.height;
    const lm = lastLandmarks;
    const fcx = ((lm[234].x + lm[454].x) / 2) * W;
    const fcy = ((lm[10].y + lm[152].y) / 2) * H;
    face = canvasToScreen(fcx, fcy, canvasEl);
    candidates = candidates.concat([
      { x: face.x - D, y: face.y },
      { x: face.x + D, y: face.y },
      { x: face.x, y: face.y - D },
    ]);
  }

  // 화면 안쪽으로 클램프 + 얼굴 너무 가까운 곳 제외
  const valid = candidates
    .map((c) => ({
      x: Math.max(m, Math.min(vw - m, c.x)),
      y: Math.max(m, Math.min(vh - m, c.y)),
    }))
    .filter((c) => !face || Math.hypot(c.x - face.x, c.y - face.y) > vmin * 0.22);

  const pool = valid.length ? valid : candidates;
  return pool[(Math.random() * pool.length) | 0];
}

function spawnPeek(canvasEl) {
  if (!layerEl) return;
  const spot = pickSpot(canvasEl);
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const el = document.createElement("div");
  el.className = "peek-animal";
  el.textContent = ANIMALS[(Math.random() * ANIMALS.length) | 0];
  el.style.left = `${spot.x}px`;
  el.style.top = `${spot.y}px`;
  layerEl.appendChild(el);
  peeks.push({
    el,
    x: spot.x,
    y: spot.y,
    r: vmin * 0.13,
    bornAt: performance.now(),
    status: "in",
  });
}

function catchAt(x, y) {
  for (let i = peeks.length - 1; i >= 0; i--) {
    const p = peeks[i];
    if (p.status === "in" && Math.hypot(p.x - x, p.y - y) < p.r) {
      catchPeek(p);
      return;
    }
  }
}

function catchPeek(p) {
  if (p.status !== "in") return;
  p.status = "caught";
  p.el.classList.add("caught");
  playSparkle();
  starBurst(p.x, p.y);
  score++;
  if (starBarEl) starBarEl.textContent = `⭐ ${score}`;
  setTimeout(() => removePeek(p), 480);
  nextSpawnAt = performance.now() + 400; // 다음 빼꼼 빨리
}

function hidePeek(p) {
  if (p.status !== "in") return;
  p.status = "hiding";
  p.el.classList.add("hiding");
  setTimeout(() => removePeek(p), 320);
}

function removePeek(p) {
  if (p.el && p.el.parentNode) p.el.remove();
  peeks = peeks.filter((x) => x !== p);
}

function starBurst(x, y) {
  const STARS = ["⭐", "✨", "🌟", "💫"];
  for (let k = 0; k < 5; k++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = STARS[(Math.random() * STARS.length) | 0];
    s.style.left = `${x + (Math.random() - 0.5) * 80}px`;
    s.style.top = `${y + (Math.random() - 0.5) * 80}px`;
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  }
}

// 얼굴 가렸다 떼면 큰 "까꿍!" 보너스
function triggerBonus() {
  const gameEl = document.getElementById("game");
  if (!gameEl) return;
  const animal = ANIMALS[(Math.random() * ANIMALS.length) | 0];
  const el = document.createElement("div");
  el.className = "peekaboo-reveal";
  el.innerHTML =
    '<div class="peekaboo-text">까꿍!</div>' +
    `<div class="peekaboo-animal">${animal}</div>`;
  gameEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 2200);
  playPeekaboo();
  // 보너스 별
  score += 3;
  if (starBarEl) starBarEl.textContent = `⭐ ${score}`;
  starBurst(window.innerWidth / 2, window.innerHeight / 2);
}

export function stopPeekaboo(videoEl, canvasEl) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  const gameEl = document.getElementById("game");
  if (pointerHandler && gameEl) {
    gameEl.removeEventListener("pointerdown", pointerHandler);
    pointerHandler = null;
  }
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  peeks.forEach((p) => p.el && p.el.remove());
  peeks = [];
  if (layerEl) { layerEl.remove(); layerEl = null; }
  if (starBarEl) { starBarEl.remove(); starBarEl = null; }
  document.querySelectorAll(".peekaboo-reveal, .sparkle").forEach((el) => el.remove());
  if (canvasEl) {
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
  lastVideoTime = -1;
  lastLandmarks = null;
  coverState = "waiting";
}
