// 매직 거울: 얼굴에 동물 귀 + 안경 + 모자를 얹고, 화면 터치 시 반짝 효과
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/vision_bundle.mjs";

import { playSparkle } from "../audio.js";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ----- 스타일 세트 (몇 초마다 자동 전환) -----
const EAR_STYLES = ["rabbit", "cat", "bear"];
const GLASSES_STYLES = ["🕶️", "👓", "🥽"];
const HAT_STYLES = ["🎩", "👑", "🎉", "🧢"];
const STYLE_INTERVAL_MS = 4000;

let faceLandmarker = null;
let rafId = null;
let lastVideoTime = -1;
let styleIndex = 0;
let lastStyleSwitch = 0;
let lastLandmarks = null;
let lastSeenAt = 0;
let tapHandler = null;

// 주요 랜드마크 인덱스 (MediaPipe FaceLandmarker)
const L = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  foreheadTop: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
};

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export async function startMirror(videoEl, canvasEl, onReady) {
  const ctx = canvasEl.getContext("2d");

  // 모델 로딩
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  // 캔버스 해상도를 영상 원본에 맞춤 (CSS object-fit:cover 가 동일하게 처리)
  function syncCanvasSize() {
    if (videoEl.videoWidth && videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }
  }
  syncCanvasSize();

  // 화면 터치 → 반짝 효과 (DOM 파티클, 좌표 변환 불필요)
  tapHandler = (e) => {
    if (e.target.closest(".ctrl-btn")) return; // 부모용 버튼은 제외
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (x == null) return;
    spawnSparkle(x, y);
    playSparkle();
  };
  const gameEl = document.getElementById("game");
  gameEl.addEventListener("pointerdown", tapHandler);

  let ready = false;
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (!faceLandmarker || !videoEl.videoWidth) return;
    syncCanvasSize();

    const now = performance.now();
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      const res = faceLandmarker.detectForVideo(videoEl, now);
      if (res.faceLandmarks && res.faceLandmarks.length > 0) {
        lastLandmarks = res.faceLandmarks[0];
        lastSeenAt = now;
      }
    }

    // 스타일 자동 전환
    if (now - lastStyleSwitch > STYLE_INTERVAL_MS) {
      styleIndex++;
      lastStyleSwitch = now;
    }

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // 얼굴이 최근에 보였으면 스티커 그림 (잠깐 사라져도 유지 → 깜빡임 방지)
    if (lastLandmarks && now - lastSeenAt < 500) {
      drawStickers(ctx, canvasEl, lastLandmarks);
    }

    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  }
  loop();
}

function drawStickers(ctx, canvas, lm) {
  const W = canvas.width;
  const H = canvas.height;
  const toPx = (p) => ({ x: p.x * W, y: p.y * H });

  const leftEye = mid(toPx(lm[L.leftEyeOuter]), toPx(lm[L.leftEyeInner]));
  const rightEye = mid(toPx(lm[L.rightEyeOuter]), toPx(lm[L.rightEyeInner]));
  const eyesCenter = mid(leftEye, rightEye);
  const eyeDist = dist(leftEye, rightEye);

  const top = toPx(lm[L.foreheadTop]);
  const chin = toPx(lm[L.chin]);
  const faceH = dist(top, chin);
  const faceW = dist(toPx(lm[L.leftCheek]), toPx(lm[L.rightCheek]));

  // 머리 기울기
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  // "위" 방향 (턱 → 이마)
  const up = { x: top.x - chin.x, y: top.y - chin.y };
  const upLen = Math.hypot(up.x, up.y) || 1;
  up.x /= upLen;
  up.y /= upLen;

  const earsAnchor = { x: top.x + up.x * faceH * 0.12, y: top.y + up.y * faceH * 0.12 };
  const hatAnchor = { x: top.x + up.x * faceH * 0.42, y: top.y + up.y * faceH * 0.42 };

  // ----- 귀 -----
  drawEars(ctx, earsAnchor, roll, faceW, EAR_STYLES[styleIndex % EAR_STYLES.length]);

  // ----- 안경 -----
  drawEmoji(
    ctx,
    GLASSES_STYLES[styleIndex % GLASSES_STYLES.length],
    eyesCenter,
    roll,
    eyeDist * 2.6
  );

  // ----- 모자 -----
  drawEmoji(
    ctx,
    HAT_STYLES[styleIndex % HAT_STYLES.length],
    hatAnchor,
    roll,
    faceW * 1.15
  );
}

function drawEmoji(ctx, emoji, anchor, roll, size) {
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(roll);
  ctx.font = `${size}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

function drawEars(ctx, anchor, roll, faceW, style) {
  const offX = faceW * 0.3;
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(roll);

  const drawOne = (sign) => {
    ctx.save();
    ctx.translate(sign * offX, 0);
    if (style === "rabbit") {
      // 토끼: 길쭉한 흰 귀 + 분홍 안쪽
      ctx.fillStyle = "#fff";
      ellipse(ctx, 0, -faceW * 0.18, faceW * 0.1, faceW * 0.32);
      ctx.fillStyle = "#ffb6d5";
      ellipse(ctx, 0, -faceW * 0.18, faceW * 0.05, faceW * 0.22);
    } else if (style === "cat") {
      // 고양이: 삼각형 귀
      ctx.fillStyle = "#5a4a4a";
      triangle(ctx, faceW * 0.22);
      ctx.fillStyle = "#ffb6d5";
      triangle(ctx, faceW * 0.12);
    } else {
      // 곰: 둥근 귀
      ctx.fillStyle = "#8a5a2b";
      circle(ctx, 0, -faceW * 0.05, faceW * 0.16);
      ctx.fillStyle = "#c98a4b";
      circle(ctx, 0, -faceW * 0.05, faceW * 0.09);
    }
    ctx.restore();
  };
  drawOne(-1);
  drawOne(1);
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function triangle(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(-s * 0.8, s * 0.4);
  ctx.lineTo(s * 0.8, s * 0.4);
  ctx.closePath();
  ctx.fill();
}

// ----- 터치 반짝 효과 (DOM) -----
const SPARKLE_EMOJIS = ["⭐", "💖", "🫧", "✨", "🌟"];
function spawnSparkle(x, y) {
  const el = document.createElement("span");
  el.className = "sparkle";
  el.textContent =
    SPARKLE_EMOJIS[Math.floor(Math.random() * SPARKLE_EMOJIS.length)];
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

export function stopMirror(videoEl, canvasEl) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (tapHandler) {
    const gameEl = document.getElementById("game");
    gameEl.removeEventListener("pointerdown", tapHandler);
    tapHandler = null;
  }
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  if (canvasEl) {
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
  lastLandmarks = null;
  lastVideoTime = -1;
}
