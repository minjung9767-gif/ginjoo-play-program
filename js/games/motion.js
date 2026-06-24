// 움직임 마법: 비눗방울이 사방에서 둥실 나타나고, 손이 닿으면 펑! 터짐.
// 터뜨리기 = 화면 터치 + 카메라 앞 손 움직임 (둘 다).
import { playPop } from "../audio.js";
import { screenToCanvas } from "../coords.js";

const GRID_W = 80; // 움직임 감지용 저해상도 샘플 크기
const GRID_H = 60;
const DIFF_THRESHOLD = 90; // 픽셀 변화량 임계값
const TARGET_BUBBLES = 8; // 화면에 유지할 비눗방울 수
const BUBBLE_COLORS = [
  "#7ec8ff", "#ff9ecf", "#a0f0c0", "#ffd86b", "#c3a0ff", "#ff8f8f",
];

let rafId = null;
let tapHandler = null;

export async function startMotion(videoEl, canvasEl, onReady) {
  const ctx = canvasEl.getContext("2d");

  // 움직임 감지용 오프스크린 캔버스 (저해상도)
  const off = document.createElement("canvas");
  off.width = GRID_W;
  off.height = GRID_H;
  const octx = off.getContext("2d", { willReadFrequently: true });

  let prev = null;
  let ready = false;
  const bubbles = [];
  const pops = []; // 터지는 효과 파편

  function syncCanvasSize() {
    if (videoEl.videoWidth && videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }
  }
  syncCanvasSize();

  // 화면 터치 → 닿은 지점 근처 비눗방울 터뜨리기
  tapHandler = (e) => {
    if (e.target.closest(".ctrl-btn")) return; // 부모용 버튼 제외
    const cx = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const cy = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (cx == null) return;
    const pt = screenToCanvas(cx, cy, canvasEl);
    popNear(pt.x, pt.y, canvasEl.height * 0.06);
  };
  const gameEl = document.getElementById("game");
  gameEl.addEventListener("pointerdown", tapHandler);

  function popNear(x, y, extraRadius) {
    let popped = false;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (Math.hypot(b.x - x, b.y - y) < b.r + extraRadius) {
        popBubble(b);
        bubbles.splice(i, 1);
        popped = true;
      }
    }
    return popped;
  }

  function popBubble(b) {
    for (let k = 0; k < 8; k++) {
      const ang = (Math.PI * 2 * k) / 8 + Math.random();
      const spd = b.r * (0.06 + Math.random() * 0.06);
      pops.push({
        x: b.x, y: b.y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: b.r * 0.18, color: b.color, life: 0, maxLife: 22,
      });
    }
    playPop();
  }

  function spawnBubble(W, H) {
    const r = H * (0.06 + Math.random() * 0.06);
    bubbles.push({
      x: r + Math.random() * (W - 2 * r),
      y: r + Math.random() * (H - 2 * r),
      r,
      color: BUBBLE_COLORS[(Math.random() * BUBBLE_COLORS.length) | 0],
      vx: (Math.random() - 0.5) * W * 0.0015,
      vy: (Math.random() - 0.5) * H * 0.0015,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      maxAge: 360 + Math.random() * 240, // 안 터지면 일정 시간 뒤 사라짐
    });
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (!videoEl.videoWidth) return;
    syncCanvasSize();
    const W = canvasEl.width;
    const H = canvasEl.height;

    // 비눗방울 수 유지
    while (bubbles.length < TARGET_BUBBLES) spawnBubble(W, H);

    // 카메라 움직임 감지 → 겹치는 비눗방울 터뜨리기
    octx.drawImage(videoEl, 0, 0, GRID_W, GRID_H);
    const cur = octx.getImageData(0, 0, GRID_W, GRID_H).data;
    if (prev) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        // 비눗방울 중심을 저해상도 격자 좌표로
        const gx = Math.min(GRID_W - 1, Math.max(0, (b.x / W) * GRID_W)) | 0;
        const gy = Math.min(GRID_H - 1, Math.max(0, (b.y / H) * GRID_H)) | 0;
        const idx = (gy * GRID_W + gx) * 4;
        const d =
          Math.abs(cur[idx] - prev[idx]) +
          Math.abs(cur[idx + 1] - prev[idx + 1]) +
          Math.abs(cur[idx + 2] - prev[idx + 2]);
        if (d > DIFF_THRESHOLD) {
          popBubble(b);
          bubbles.splice(i, 1);
        }
      }
    }
    prev = cur.slice();

    // 그리기
    ctx.clearRect(0, 0, W, H);

    // 비눗방울 갱신 & 그리기
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age++;
      b.phase += 0.05;
      b.x += b.vx + Math.sin(b.phase) * W * 0.0004; // 살랑살랑 떠다님
      b.y += b.vy + Math.cos(b.phase) * H * 0.0004;
      // 벽에서 부드럽게 반사
      if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
      if (b.y < b.r || b.y > H - b.r) b.vy *= -1;
      b.x = Math.max(b.r, Math.min(W - b.r, b.x));
      b.y = Math.max(b.r, Math.min(H - b.r, b.y));
      if (b.age > b.maxAge) {
        bubbles.splice(i, 1);
        continue;
      }
      // 등장/퇴장 페이드
      const fadeIn = Math.min(1, b.age / 20);
      const fadeOut = Math.min(1, (b.maxAge - b.age) / 40);
      drawBubble(ctx, b, Math.min(fadeIn, fadeOut));
    }

    // 터짐 파편 갱신 & 그리기
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        pops.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  }
  loop();
}

function drawBubble(ctx, b, alpha) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha) * 0.85;
  // 비눗방울 본체 (반투명 그라데이션)
  const grad = ctx.createRadialGradient(
    b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1,
    b.x, b.y, b.r
  );
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.25, b.color);
  grad.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  // 테두리
  ctx.globalAlpha = Math.max(0, alpha) * 0.5;
  ctx.lineWidth = Math.max(1, b.r * 0.04);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.stroke();
  // 반짝이는 하이라이트
  ctx.globalAlpha = Math.max(0, alpha) * 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function stopMotion(videoEl, canvasEl) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (tapHandler) {
    const gameEl = document.getElementById("game");
    gameEl.removeEventListener("pointerdown", tapHandler);
    tapHandler = null;
  }
  if (canvasEl) {
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }
}
