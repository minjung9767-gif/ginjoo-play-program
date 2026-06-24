// 영상통화 놀이: 셀카 영상통화 화면.
// 대기중(콜라 음악) → [통화 연결] → 연결 중… → 통화중(내 얼굴 + 통화 UI + 스티커 깜짝 등장/사라짐)
//                   ← [통화 종료(빨강)] 누르면 다시 대기중(음악 재생)
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/vision_bundle.mjs";

import { playCallMusic, stopCallMusic } from "../audio.js";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// 스티커 스타일 (깜짝 등장할 때마다 바뀜)
const EAR_STYLES = ["rabbit", "cat", "bear"];
const GLASSES_STYLES = ["🕶️", "👓", "🥽"];
const HAT_STYLES = ["🎩", "👑", "🎉", "🧢"];
const SHOW_MS = 6000; // 스티커 보이는 시간
const HIDE_MS = 5000; // 스티커 사라져 있는 시간

let faceLandmarker = null;
let rafId = null;
let lastVideoTime = -1;
let lastLandmarks = null;
let lastSeenAt = 0;

let callState = "standby"; // standby | connecting | incall
let connectTimer = null;
let callStartAt = 0;
let cycleStart = 0;
let styleIndex = 0;
let wasShowing = false;

// DOM 참조
let uiEl = null;
let standbyEl = null;
let connectingEl = null;
let incallEl = null;
let timerEl = null;

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

  // 상태 초기화
  lastVideoTime = -1;
  lastLandmarks = null;
  callState = "standby";
  styleIndex = 0;
  wasShowing = false;

  // 모델 로딩 (통화중 스티커용)
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  buildUI();
  setState("standby");
  playCallMusic();

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
    if (!videoEl.videoWidth) return;
    syncCanvasSize();
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (callState === "incall") {
      const now = performance.now();
      // 얼굴 추적
      if (videoEl.currentTime !== lastVideoTime) {
        lastVideoTime = videoEl.currentTime;
        const res = faceLandmarker.detectForVideo(videoEl, now);
        if (res.faceLandmarks && res.faceLandmarks.length > 0) {
          lastLandmarks = res.faceLandmarks[0];
          lastSeenAt = now;
        }
      }

      // 스티커 깜짝 등장/사라짐 사이클
      const phase = (now - cycleStart) % (SHOW_MS + HIDE_MS);
      const showing = phase < SHOW_MS;
      if (showing && !wasShowing) {
        styleIndex++; // 새로 등장할 때마다 다른 스타일
      }
      wasShowing = showing;
      if (showing && lastLandmarks && now - lastSeenAt < 600) {
        drawStickers(ctx, canvasEl, lastLandmarks);
      }

      // 통화 시간 갱신
      updateTimer();
    }

    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  }
  loop();
}

// ---------- 통화 상태 ----------
function setState(s) {
  callState = s;
  if (standbyEl) standbyEl.classList.toggle("hidden", s !== "standby");
  if (connectingEl) connectingEl.classList.toggle("hidden", s !== "connecting");
  if (incallEl) incallEl.classList.toggle("hidden", s !== "incall");
}

function onConnect() {
  stopCallMusic();
  setState("connecting");
  if (connectTimer) clearTimeout(connectTimer);
  connectTimer = setTimeout(() => {
    callStartAt = performance.now();
    cycleStart = performance.now();
    wasShowing = false;
    setState("incall");
  }, 2200);
}

function onEnd() {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  lastLandmarks = null;
  setState("standby");
  playCallMusic();
}

function updateTimer() {
  if (!timerEl) return;
  const sec = Math.floor((performance.now() - callStartAt) / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
}

// ---------- UI ----------
function buildUI() {
  const gameEl = document.getElementById("game");
  uiEl = document.createElement("div");
  uiEl.className = "call-ui";

  // 대기중
  standbyEl = document.createElement("div");
  standbyEl.className = "call-standby";
  standbyEl.innerHTML =
    '<div class="call-avatar">🧸</div>' +
    '<div class="call-name">긴주</div>' +
    '<div class="call-status">영상통화 대기중…</div>';
  const connectBtn = document.createElement("button");
  connectBtn.className = "call-btn call-connect";
  connectBtn.innerHTML = "📞";
  connectBtn.setAttribute("aria-label", "통화 연결");
  connectBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onConnect();
  });
  standbyEl.appendChild(connectBtn);

  // 연결 중
  connectingEl = document.createElement("div");
  connectingEl.className = "call-connecting hidden";
  connectingEl.innerHTML =
    '<div class="call-avatar pulse">🧸</div>' +
    '<div class="call-name">긴주</div>' +
    '<div class="call-status">연결 중<span class="dots"></span></div>';

  // 통화중 (상단 정보 + 하단 종료 버튼)
  incallEl = document.createElement("div");
  incallEl.className = "call-incall hidden";
  const topbar = document.createElement("div");
  topbar.className = "call-topbar";
  timerEl = document.createElement("span");
  timerEl.className = "call-timer";
  timerEl.textContent = "00:00";
  topbar.innerHTML = '<span class="call-name-sm">긴주 💕</span>';
  topbar.appendChild(timerEl);
  const endBtn = document.createElement("button");
  endBtn.className = "call-btn call-end";
  endBtn.innerHTML = "📞";
  endBtn.setAttribute("aria-label", "통화 종료");
  endBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onEnd();
  });
  incallEl.appendChild(topbar);
  incallEl.appendChild(endBtn);

  uiEl.appendChild(standbyEl);
  uiEl.appendChild(connectingEl);
  uiEl.appendChild(incallEl);
  gameEl.appendChild(uiEl);
}

// ---------- 스티커 그리기 ----------
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

  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const up = { x: top.x - chin.x, y: top.y - chin.y };
  const upLen = Math.hypot(up.x, up.y) || 1;
  up.x /= upLen;
  up.y /= upLen;

  const earsAnchor = { x: top.x + up.x * faceH * 0.12, y: top.y + up.y * faceH * 0.12 };
  const hatAnchor = { x: top.x + up.x * faceH * 0.42, y: top.y + up.y * faceH * 0.42 };

  drawEars(ctx, earsAnchor, roll, faceW, EAR_STYLES[styleIndex % EAR_STYLES.length]);
  drawEmoji(ctx, GLASSES_STYLES[styleIndex % GLASSES_STYLES.length], eyesCenter, roll, eyeDist * 2.6);
  drawEmoji(ctx, HAT_STYLES[styleIndex % HAT_STYLES.length], hatAnchor, roll, faceW * 1.15);
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
      ctx.fillStyle = "#fff";
      ellipse(ctx, 0, -faceW * 0.18, faceW * 0.1, faceW * 0.32);
      ctx.fillStyle = "#ffb6d5";
      ellipse(ctx, 0, -faceW * 0.18, faceW * 0.05, faceW * 0.22);
    } else if (style === "cat") {
      ctx.fillStyle = "#5a4a4a";
      triangle(ctx, faceW * 0.22);
      ctx.fillStyle = "#ffb6d5";
      triangle(ctx, faceW * 0.12);
    } else {
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

export function stopMirror(videoEl, canvasEl) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  stopCallMusic();
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  if (uiEl) {
    uiEl.remove();
    uiEl = null;
    standbyEl = connectingEl = incallEl = timerEl = null;
  }
  if (canvasEl) {
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
  lastLandmarks = null;
  lastVideoTime = -1;
  callState = "standby";
}
