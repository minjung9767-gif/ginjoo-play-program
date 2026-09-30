// 삑삑 키패드: 도어록처럼 숫자 버튼을 실컷 누르는 놀이 (터치).
// 누를 때마다 삑 + 반짝, 몇 번 누르면 "열렸다!" 축하.
// 노트북처럼 넓은 가로 화면에서는 왼쪽에 📺 인터폰 화면을 두고,
// "딩동"을 누르면 화면이 켜지며 카메라로 긴주 얼굴이 나온다 (몇 초 뒤 꺼짐).
import { playKeyBeep, playDing, playDoorOpen } from "../audio.js";
import { startCamera, stopCamera } from "../camera.js";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "✕", "0", "✓"];
const CELEBRATE = ["🎉", "🚪", "🎊", "🥳", "🎈", "⭐"];
const AUTO_OPEN_AT = 6; // 숫자 이만큼 누르면 자동 축하
const INTERCOM_ON_MS = 8000; // 딩동 뒤 인터폰 화면이 켜져 있는 시간
// 인터폰 화면을 둘 만큼 넓은 화면인지 (노트북·태블릿 가로)
const WIDE_QUERY = "(orientation: landscape) and (min-width: 900px)";

let wrapEl = null;
let displayEl = null;
let pressCount = 0;
let intercomEl = null;
let intercomTimer = null;

export async function startKeypad(videoEl, canvasEl, onReady) {
  const gameEl = document.getElementById("game");
  gameEl.classList.add("keypad-mode");
  pressCount = 0;

  wrapEl = document.createElement("div");
  wrapEl.className = "keypad-wrap";

  // 넓은 화면이면 왼쪽에 인터폰 화면
  if (window.matchMedia(WIDE_QUERY).matches) {
    wrapEl.classList.add("with-intercom");
    wrapEl.appendChild(buildIntercom());
  }

  // 오른쪽(폰에서는 전체): 딩동 버튼 + 키패드
  const col = document.createElement("div");
  col.className = "keypad-col";
  wrapEl.appendChild(col);

  // 위쪽: 딩동 초인종 버튼 (밖에서 누르는 느낌)
  const bell = document.createElement("button");
  bell.className = "doorbell-btn";
  bell.innerHTML = '<span class="doorbell-icon">🛎️</span><span class="doorbell-label">딩동</span>';
  bell.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    bell.classList.add("ringing");
    setTimeout(() => bell.classList.remove("ringing"), 400);
    playDing();
    showDingDong();
    turnOnIntercom();
  });
  col.appendChild(bell);

  displayEl = document.createElement("div");
  displayEl.className = "keypad-display";
  displayEl.textContent = "";
  col.appendChild(displayEl);

  const grid = document.createElement("div");
  grid.className = "keypad-grid";
  KEYS.forEach((k) => {
    const b = document.createElement("button");
    b.className =
      "key-btn" + (k === "✕" ? " key-clear" : "") + (k === "✓" ? " key-enter" : "");
    b.textContent = k;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onKey(k, b);
    });
    grid.appendChild(b);
  });
  col.appendChild(grid);
  gameEl.appendChild(wrapEl);

  if (onReady) onReady();

  // 카메라는 미리 켜 둬야 딩동 누르자마자 얼굴이 바로 나온다 (화면은 꺼진 채로 대기)
  if (intercomEl) connectCamera(intercomEl);
}

// 📺 인터폰 모니터 (테두리 + 화면 + 스피커 구멍)
function buildIntercom() {
  intercomEl = document.createElement("div");
  intercomEl.className = "intercom";
  intercomEl.innerHTML = `
    <div class="intercom-screen">
      <video class="intercom-video" playsinline autoplay muted></video>
      <div class="intercom-fallback">🐶</div>
      <div class="intercom-rec">● 현관</div>
      <div class="intercom-caption">딩동~ 누구세요?</div>
      <div class="intercom-hint">🛎️</div>
    </div>
    <div class="intercom-bottom">
      <span class="intercom-led"></span>
      <span class="intercom-speaker"></span>
    </div>`;
  return intercomEl;
}

async function connectCamera(el) {
  const v = el.querySelector(".intercom-video");
  try {
    await startCamera(v);
    // 카메라 준비 중에 놀이를 나갔으면 바로 끈다
    if (intercomEl !== el) stopCamera(v);
  } catch (err) {
    // 카메라가 없거나 허락을 안 하면 강아지 그림으로 대신
    el.classList.add("no-camera");
  }
}

function turnOnIntercom() {
  if (!intercomEl) return;
  intercomEl.classList.remove("on");
  void intercomEl.offsetWidth; // 다시 누르면 "딸깍" 켜지는 효과를 처음부터
  intercomEl.classList.add("on");
  clearTimeout(intercomTimer);
  intercomTimer = setTimeout(() => {
    if (intercomEl) intercomEl.classList.remove("on");
  }, INTERCOM_ON_MS);
}

function onKey(k, btn) {
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 130);

  if (k === "✓") {
    celebrate();
    clearDisplay();
    return;
  }
  if (k === "✕") {
    playKeyBeep(0);
    clearDisplay();
    return;
  }
  // 숫자 버튼
  playKeyBeep(parseInt(k, 10));
  addDigit(k);
  pressCount++;
  if (pressCount >= AUTO_OPEN_AT) {
    celebrate();
    clearDisplay();
  }
}

// "딩동!" 글자 잠깐 띄우기
function showDingDong() {
  const gameEl = document.getElementById("game");
  if (!gameEl) return;
  const el = document.createElement("div");
  el.className = "dingdong-pop";
  el.textContent = "딩동!";
  gameEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 1200);
}

function addDigit(d) {
  if (!displayEl) return;
  let t = displayEl.textContent + d;
  if (t.length > 6) t = d;
  displayEl.textContent = t;
}

function clearDisplay() {
  if (displayEl) displayEl.textContent = "";
  pressCount = 0;
}

function celebrate() {
  const gameEl = document.getElementById("game");
  if (!gameEl) return;
  playDoorOpen();
  const emoji = CELEBRATE[(Math.random() * CELEBRATE.length) | 0];
  const el = document.createElement("div");
  el.className = "keypad-celebrate";
  el.innerHTML = `<div class="c-emoji">${emoji}</div><div class="c-text">열렸다!</div>`;
  gameEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 2300);
  starBurst();
}

function starBurst() {
  const STARS = ["⭐", "✨", "🎉", "🌟", "🎊"];
  for (let k = 0; k < 10; k++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = STARS[(Math.random() * STARS.length) | 0];
    s.style.left = `${window.innerWidth * (0.2 + Math.random() * 0.6)}px`;
    s.style.top = `${window.innerHeight * (0.2 + Math.random() * 0.6)}px`;
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  }
}

export function stopKeypad() {
  const gameEl = document.getElementById("game");
  if (gameEl) gameEl.classList.remove("keypad-mode");
  clearTimeout(intercomTimer);
  intercomTimer = null;
  if (intercomEl) {
    stopCamera(intercomEl.querySelector(".intercom-video"));
    intercomEl = null;
  }
  if (wrapEl) {
    wrapEl.remove();
    wrapEl = null;
  }
  document.querySelectorAll(".keypad-celebrate, .sparkle, .dingdong-pop").forEach((el) => el.remove());
  displayEl = null;
  pressCount = 0;
}
