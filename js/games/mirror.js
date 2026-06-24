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

// 귀여운 동물 변신 세트 (등장할 때마다 바뀜)
const ANIMAL_SETS = ["rabbit", "bear", "cat", "puppy", "panda"];
const INITIAL_DELAY = 10000; // 전화 받고 처음 등장까지 (10초)
const SHOW_MS = 5000; // 보이는 시간 (5초)
const HIDE_MS = 5000; // 사라져 있는 시간 (5초)

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

      // 스티커: 처음 10초는 안 나오고, 이후 5초 등장 / 5초 사라짐 반복
      const elapsed = now - callStartAt;
      let showing = false;
      if (elapsed >= INITIAL_DELAY) {
        const phase = (elapsed - INITIAL_DELAY) % (SHOW_MS + HIDE_MS);
        showing = phase < SHOW_MS;
      }
      if (showing && !wasShowing) {
        styleIndex++; // 새로 등장할 때마다 다른 동물
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

// ---------- 귀여운 동물 변신 그리기 ----------
// 둥글둥글한 귀 + 코 + 볼터치(+수염)로 부드럽게. (이모지 대신 직접 그림)
function drawStickers(ctx, canvas, lm) {
  const W = canvas.width;
  const H = canvas.height;
  const toPx = (p) => ({ x: p.x * W, y: p.y * H });

  const leftEye = mid(toPx(lm[L.leftEyeOuter]), toPx(lm[L.leftEyeInner]));
  const rightEye = mid(toPx(lm[L.rightEyeOuter]), toPx(lm[L.rightEyeInner]));
  const eyeDist = dist(leftEye, rightEye);

  const top = toPx(lm[L.foreheadTop]);
  const chin = toPx(lm[L.chin]);
  const faceH = dist(top, chin);
  const faceW = dist(toPx(lm[L.leftCheek]), toPx(lm[L.rightCheek]));
  const noseTip = toPx(lm[1]);

  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const up = { x: top.x - chin.x, y: top.y - chin.y };
  const upLen = Math.hypot(up.x, up.y) || 1;
  up.x /= upLen;
  up.y /= upLen;
  // 얼굴 가로(오른쪽) 단위 벡터
  const right = { x: rightEye.x - leftEye.x, y: rightEye.y - leftEye.y };
  const rLen = Math.hypot(right.x, right.y) || 1;
  right.x /= rLen;
  right.y /= rLen;

  const style = ANIMAL_SETS[styleIndex % ANIMAL_SETS.length];
  const earsAnchor = { x: top.x + up.x * faceH * 0.12, y: top.y + up.y * faceH * 0.12 };

  drawEars(ctx, earsAnchor, roll, faceW, style);
  drawCheeks(ctx, noseTip, right, up, faceW, faceH);
  drawNose(ctx, noseTip, roll, faceW, style);
  if (style === "cat" || style === "puppy") {
    drawWhiskers(ctx, noseTip, right, up, faceW);
  }
}

// 볼터치 (양 볼에 발그레한 분홍 원)
function drawCheeks(ctx, nose, right, up, faceW, faceH) {
  const off = faceW * 0.34;
  const down = faceH * 0.04;
  const r = faceW * 0.11;
  [-1, 1].forEach((sign) => {
    const cx = nose.x + right.x * off * sign - up.x * down;
    const cy = nose.y + right.y * off * sign - up.y * down;
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, "rgba(255,150,180,0.65)");
    g.addColorStop(1, "rgba(255,150,180,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// 동물 코
function drawNose(ctx, nose, roll, faceW, style) {
  ctx.save();
  ctx.translate(nose.x, nose.y);
  ctx.rotate(roll);
  if (style === "rabbit") {
    ctx.fillStyle = "#ff8fb3";
    roundedTriangle(ctx, faceW * 0.07);
  } else if (style === "cat") {
    ctx.fillStyle = "#ff8fb3";
    roundedTriangle(ctx, faceW * 0.055);
  } else if (style === "panda" || style === "bear") {
    ctx.fillStyle = "#3a2b22";
    ellipse(ctx, 0, 0, faceW * 0.09, faceW * 0.07);
  } else {
    // puppy
    ctx.fillStyle = "#2b2b2b";
    ellipse(ctx, 0, 0, faceW * 0.085, faceW * 0.065);
  }
  // 코 하이라이트
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  circle(ctx, -faceW * 0.02, -faceW * 0.02, faceW * 0.02);
  ctx.restore();
}

// 수염
function drawWhiskers(ctx, nose, right, up, faceW) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(2, faceW * 0.012);
  ctx.lineCap = "round";
  const len = faceW * 0.4;
  [-1, 1].forEach((sign) => {
    [-0.06, 0, 0.06].forEach((tilt) => {
      const sx = nose.x + right.x * faceW * 0.12 * sign;
      const sy = nose.y + right.y * faceW * 0.12 * sign;
      const dx = right.x * len * sign - up.x * len * tilt;
      const dy = right.y * len * sign - up.y * len * tilt;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + dx, sy + dy);
      ctx.stroke();
    });
  });
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
      ellipse(ctx, 0, -faceW * 0.2, faceW * 0.1, faceW * 0.34);
      ctx.fillStyle = "#ffc1da";
      ellipse(ctx, 0, -faceW * 0.18, faceW * 0.05, faceW * 0.24);
    } else if (style === "cat") {
      ctx.fillStyle = "#7a6a66";
      roundedTriangleUp(ctx, faceW * 0.24);
      ctx.fillStyle = "#ffc1da";
      roundedTriangleUp(ctx, faceW * 0.13);
    } else if (style === "puppy") {
      // 둥글게 늘어진 귀
      ctx.fillStyle = "#a9743f";
      ellipse(ctx, 0, faceW * 0.04, faceW * 0.12, faceW * 0.22);
    } else if (style === "panda") {
      ctx.fillStyle = "#2b2b2b";
      circle(ctx, 0, -faceW * 0.05, faceW * 0.15);
    } else {
      // bear
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
// 모서리가 둥근 삼각형 (아래로 뾰족 - 코)
function roundedTriangle(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.6);
  ctx.quadraticCurveTo(0, -s * 0.9, s, -s * 0.6);
  ctx.quadraticCurveTo(s * 0.6, s * 0.5, 0, s);
  ctx.quadraticCurveTo(-s * 0.6, s * 0.5, -s, -s * 0.6);
  ctx.closePath();
  ctx.fill();
}
// 위로 뾰족한 둥근 삼각형 (고양이 귀)
function roundedTriangleUp(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.2, s * 0.8, s * 0.4);
  ctx.quadraticCurveTo(0, s * 0.2, -s * 0.8, s * 0.4);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.2, 0, -s);
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
