// 까꿍 동물: 얼굴을 가렸다가 다시 보이면 "까꿍!"과 함께 동물이 등장 + 소리.
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/vision_bundle.mjs";

import { playPeekaboo } from "../audio.js";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const ANIMALS = ["🐻", "🐰", "🐱", "🐶", "🦁", "🐯", "🐼", "🐸", "🐵", "🐷", "🐮", "🐥", "🦄", "🐧"];
const HIDDEN_MS = 500; // 이 시간 이상 얼굴이 사라지면 "가린" 것으로 간주
const VISIBLE_MS = 250; // 최근 이 시간 내 검출되면 "보이는" 것

let faceLandmarker = null;
let rafId = null;
let lastVideoTime = -1;
let lastSeenAt = 0;
let everSeen = false;
let state = "waiting"; // waiting(보임) → hidden(가림) → 다시 보이면 까꿍

export async function startPeekaboo(videoEl, canvasEl, onReady) {
  const ctx = canvasEl.getContext("2d");

  // 상태 초기화
  lastVideoTime = -1;
  lastSeenAt = 0;
  everSeen = false;
  state = "waiting";

  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  function syncCanvasSize() {
    if (videoEl.videoWidth && videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }
  }
  syncCanvasSize();

  let ready = false;
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (!faceLandmarker || !videoEl.videoWidth) return;

    const now = performance.now();
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      const res = faceLandmarker.detectForVideo(videoEl, now);
      if (res.faceLandmarks && res.faceLandmarks.length > 0) {
        lastSeenAt = now;
        everSeen = true;
      }
    }

    const visibleNow = now - lastSeenAt < VISIBLE_MS;
    if (everSeen) {
      if (state === "waiting" && now - lastSeenAt > HIDDEN_MS) {
        state = "hidden";
      } else if (state === "hidden" && visibleNow) {
        state = "waiting";
        triggerReveal();
      }
    }

    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  }
  loop();
}

function triggerReveal() {
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
  // 안전장치: 애니메이션 이벤트 누락 대비
  setTimeout(() => el.remove(), 2200);
  playPeekaboo();
}

export function stopPeekaboo(videoEl, canvasEl) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  // 남아있는 등장 오버레이 제거
  document.querySelectorAll(".peekaboo-reveal").forEach((el) => el.remove());
  if (canvasEl) {
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
  lastVideoTime = -1;
  state = "waiting";
}
