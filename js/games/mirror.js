// 영상통화 놀이: 셀카 영상통화 화면.
// 대기중(콜라 음악) → [통화 연결] → 연결 중… → 통화중(내 얼굴 + 통화 UI + 스티커 깜짝 등장/사라짐)
//                   ← [통화 종료(빨강)] 누르면 다시 대기중(음악 재생)
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/vision_bundle.mjs";

import { playCallMusic, stopCallMusic, playDoorOpen } from "../audio.js";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// 귀여운 동물 변신 세트 (등장할 때마다 바뀜)
const ANIMAL_SETS = ["rabbit", "bear", "cat", "puppy", "panda"];
const INITIAL_DELAY = 5000; // 연결 시작 후 처음 등장까지 (5초)
const CHANGE_MS = 5000; // 이후 5초마다 다른 모양으로 변경 (사라지지 않음)

// 🐾 입 반응: 활짝 웃을수록(=쪽쪽이를 빼야 가능) 동물 입이 커지고, 크게 벌리면 반짝이가 팡!
// 이 비율(입 벌림 거리 ÷ 두 눈 사이 거리)은 실제로 써 보면서 조정할 수 있음.
const MOUTH_BIG_SMILE_RATIO = 0.55;
const SMILE_BURST_COOLDOWN_MS = 1200; // 반짝이 재발동 최소 간격
const SPARKLE_LIFE_MS = 650; // 반짝이 한 알갱이가 사라지기까지 시간
const BURST_KINDS = ["sparkle", "heart", "star"]; // 매번 랜덤하게 골라서 지루하지 않게
const REACT_DURATION_MS = 600; // 활짝 웃을 때 스티커가 통통 튀고 귀가 흔들리는 시간

let faceLandmarker = null;
let rafId = null;
let lastVideoTime = -1;
let lastFaces = null;
let lastSeenAt = 0;
let mouthState = []; // 얼굴별 입 반응 상태 (쿨다운·통통튀기)
let sparkles = []; // 활짝 웃을 때 팡 터지는 반짝이 알갱이들

let callState = "standby"; // standby | connecting | incall
let connectTimer = null;
let callStartAt = 0; // "통화중" 시작 시각 (통화 시간 표시용)
let callBeginAt = 0; // 영상통화 입장(대기중) 시각 (동물 등장 기준 시계)
let styleIndex = 0;

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
const MOUTH = { top: 13, bottom: 14 }; // 윗입술 안쪽 / 아랫입술 안쪽 중앙점

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
  lastFaces = null;
  callState = "standby";
  styleIndex = 0;
  mouthState = [];
  sparkles = [];

  // 모델 로딩 (통화중 스티커용)
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 4, // 여러 명(최대 4명)에게 동시에 동물 필터 적용
  });

  buildUI();
  setState("standby");
  callBeginAt = performance.now(); // 동물 등장 기준 시계: 영상통화 입장(대기중)과 동시에 시작
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

    const now = performance.now();
    // 얼굴 추적 (대기중부터 항상)
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      const res = faceLandmarker.detectForVideo(videoEl, now);
      if (res.faceLandmarks && res.faceLandmarks.length > 0) {
        lastFaces = res.faceLandmarks;
        lastSeenAt = now;
      }
    }

    // 스티커: 입장 후 처음 5초는 안 나오고, 이후 계속 떠 있으며 5초마다 모양만 바뀜
    // (대기중 · 연결 중 · 통화중 모든 상태에서 표시)
    const elapsed = now - callBeginAt;
    if (elapsed >= INITIAL_DELAY && lastFaces && now - lastSeenAt < 600) {
      styleIndex = Math.floor((elapsed - INITIAL_DELAY) / CHANGE_MS);
      // 잡힌 얼굴 전부에 동물 필터 적용 (여러 명)
      for (let i = 0; i < lastFaces.length; i++) drawStickers(ctx, canvasEl, lastFaces[i], i, now);
    }
    drawSparkles(ctx, now); // 반짝이는 스티커 표시 여부와 무관하게 끝까지 애니메이션

    // 통화 시간 갱신 (통화중에만)
    if (callState === "incall") updateTimer();

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
    setState("incall");
  }, 2200);
}

function onEnd() {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  lastFaces = null;
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

  // 대기중 (위쪽 라벨 + 아래쪽 통화 연결 버튼, 가운데는 비워서 아기 얼굴이 보이게)
  standbyEl = document.createElement("div");
  standbyEl.className = "call-standby";
  standbyEl.innerHTML = '<div class="call-toplabel">📞 긴주 · 영상통화 대기중</div>';
  const connectBtn = document.createElement("button");
  connectBtn.className = "call-btn call-connect";
  connectBtn.innerHTML = `<svg viewBox="0 0 24 24" class="call-icon" aria-hidden="true"><path fill="#fff" stroke="#fff" stroke-width="0.6" stroke-linejoin="round" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
  connectBtn.setAttribute("aria-label", "통화 연결");
  connectBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onConnect();
  });
  standbyEl.appendChild(connectBtn);

  // 연결 중 (위쪽 라벨만, 가운데는 비움)
  connectingEl = document.createElement("div");
  connectingEl.className = "call-connecting hidden";
  connectingEl.innerHTML =
    '<div class="call-toplabel">📞 긴주 · 연결 중<span class="dots"></span></div>';

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
  endBtn.innerHTML = `<svg viewBox="0 0 24 24" class="call-icon" aria-hidden="true"><path fill="#fff" stroke="#fff" stroke-width="0.6" stroke-linejoin="round" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
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
function drawStickers(ctx, canvas, lm, faceIndex, now) {
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

  // 🐾 입 반응: 입을 벌릴수록 동물 입도 커지고, 활짝 웃으면(=쪽쪽이 못 물고 있을 정도) 반응이 팡!
  const mouthTop = toPx(lm[MOUTH.top]);
  const mouthBottom = toPx(lm[MOUTH.bottom]);
  const mouthCenter = mid(mouthTop, mouthBottom);
  const openRatio = dist(mouthTop, mouthBottom) / eyeDist;

  const st =
    mouthState[faceIndex] || (mouthState[faceIndex] = { lastBurstAt: 0, reactUntil: 0 });

  if (openRatio > MOUTH_BIG_SMILE_RATIO && now - st.lastBurstAt > SMILE_BURST_COOLDOWN_MS) {
    const kind = BURST_KINDS[(Math.random() * BURST_KINDS.length) | 0];
    spawnSparkleBurst(mouthCenter.x, mouthCenter.y, faceW, kind);
    playDoorOpen(); // 반짝이 소리 대신, 확실히 화려하고 다른 소리로
    st.lastBurstAt = now;
    st.reactUntil = now + REACT_DURATION_MS;
  }

  // 반응 중이면(방금 활짝 웃었으면) 스티커가 통통 튀고 귀가 살랑살랑
  const reacting = now < st.reactUntil;
  const reactT = reacting ? 1 - (st.reactUntil - now) / REACT_DURATION_MS : 0;
  const bounceScale = reacting ? 1 + 0.16 * Math.sin(reactT * Math.PI) : 1;
  const earWiggle = reacting ? Math.sin(reactT * Math.PI * 4) * 0.18 : 0;
  const happyEyesAlpha = reacting ? Math.sin(reactT * Math.PI) : 0;

  ctx.save();
  ctx.translate(noseTip.x, noseTip.y);
  ctx.scale(bounceScale, bounceScale);
  ctx.translate(-noseTip.x, -noseTip.y);

  drawEars(ctx, earsAnchor, roll + earWiggle, faceW, style);
  drawCheeks(ctx, noseTip, right, up, faceW, faceH);
  drawNose(ctx, noseTip, roll, faceW, style);
  if (style === "cat" || style === "puppy") {
    drawWhiskers(ctx, noseTip, right, up, faceW);
  }
  if (happyEyesAlpha > 0.05) {
    drawHappyEyes(ctx, leftEye, rightEye, roll, faceW, happyEyesAlpha);
  }
  drawMouth(ctx, mouthCenter, roll, faceW, style, openRatio);

  ctx.restore();
}

// 활짝 웃는 순간, 눈웃음(^ ^) 모양을 실제 눈 위에 살짝 겹쳐 그리기
function drawHappyEyes(ctx, leftEye, rightEye, roll, faceW, alpha) {
  const w = faceW * 0.11;
  const h = faceW * 0.05;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(alpha, 1));
  ctx.strokeStyle = "#3a2b22";
  ctx.lineWidth = Math.max(2, faceW * 0.02);
  ctx.lineCap = "round";
  [leftEye, rightEye].forEach((eye) => {
    ctx.save();
    ctx.translate(eye.x, eye.y);
    ctx.rotate(roll);
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.2);
    ctx.quadraticCurveTo(0, -h, w, h * 0.2);
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}

// 동물 입: 평소엔 살짝 다문 모양, 입을 벌릴수록(말하기) 점점 커지다가 활짝 웃으면 동그랗게 벌어짐
function drawMouth(ctx, mouthCenter, roll, faceW, style, openRatio) {
  const mouthColor =
    style === "rabbit" || style === "cat" ? "#c9506f" : style === "puppy" ? "#2b2b2b" : "#3a2b22";
  const openness = Math.max(0, Math.min(openRatio / MOUTH_BIG_SMILE_RATIO, 1.3));
  const rx = faceW * 0.09;
  const ry = Math.max(faceW * 0.014, faceW * (0.016 + openness * 0.09));
  ctx.save();
  ctx.translate(mouthCenter.x, mouthCenter.y);
  ctx.rotate(roll);
  ctx.fillStyle = mouthColor;
  ellipse(ctx, 0, 0, rx, ry);
  if (openness > 0.5) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ellipse(ctx, 0, ry * 0.3, rx * 0.45, ry * 0.35);
  }
  ctx.restore();
}

// 활짝 웃을 때 팡 터지는 알갱이 만들기 (반짝이/하트/별 중 하나, 매번 랜덤)
function spawnSparkleBurst(x, y, faceW, kind) {
  const n = 10;
  const colors = ["#ffe08a", "#ff9fc9", "#9fe3ff", "#fff6cf"];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const speed = faceW * (0.35 + Math.random() * 0.35);
    sparkles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: faceW * (0.035 + Math.random() * 0.03),
      color: colors[i % colors.length],
      kind,
      startTime: performance.now(),
    });
  }
}

// 알갱이 그리기 + 수명 다한 것 정리
function drawSparkles(ctx, now) {
  if (!sparkles.length) return;
  sparkles = sparkles.filter((p) => now - p.startTime < SPARKLE_LIFE_MS);
  for (const p of sparkles) {
    const t = (now - p.startTime) / SPARKLE_LIFE_MS;
    const x = p.x + p.vx * t;
    const y = p.y + p.vy * t - p.size * 4 * t * (1 - t); // 살짝 붕 떴다 가라앉는 곡선
    const alpha = 1 - t;
    const size = p.size * (1 - t * 0.3);
    drawParticle(ctx, p.kind, x, y, size, p.color, alpha);
  }
}

// 알갱이 모양 하나 그리기: 반짝이(동그란 빛무리) · 하트 · 별
function drawParticle(ctx, kind, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = Math.max(alpha, 0);
  ctx.fillStyle = color;
  if (kind === "heart") {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x - size, y - size * 0.6, x - size * 0.3, y - size * 1.2, x, y - size * 0.4);
    ctx.bezierCurveTo(x + size * 0.3, y - size * 1.2, x + size, y - size * 0.6, x, y + size * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "star") {
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const a2 = a1 + Math.PI / 5;
      const p1 = { x: Math.cos(a1) * size, y: Math.sin(a1) * size };
      const p2 = { x: Math.cos(a2) * size * 0.45, y: Math.sin(a2) * size * 0.45 };
      if (i === 0) ctx.moveTo(p1.x, p1.y);
      else ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // 반짝이: 방사형으로 은은하게 퍼지는 빛무리
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  lastFaces = null;
  lastVideoTime = -1;
  callState = "standby";
  mouthState = [];
  sparkles = [];
}
