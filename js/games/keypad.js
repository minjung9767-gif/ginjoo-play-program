// 삑삑 키패드: 도어록처럼 숫자 버튼을 실컷 누르는 놀이 (카메라 불필요, 터치).
// 누를 때마다 삑 + 반짝, 몇 번 누르면 "열렸다!" 축하.
import { playKeyBeep, playDing, playDoorOpen } from "../audio.js";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "🔔", "0", "✓"];
const CELEBRATE = ["🎉", "🚪", "🎊", "🥳", "🎈", "⭐"];
const AUTO_OPEN_AT = 6; // 숫자 이만큼 누르면 자동 축하

let wrapEl = null;
let displayEl = null;
let pressCount = 0;

export async function startKeypad(videoEl, canvasEl, onReady) {
  const gameEl = document.getElementById("game");
  gameEl.classList.add("keypad-mode");
  pressCount = 0;

  wrapEl = document.createElement("div");
  wrapEl.className = "keypad-wrap";

  displayEl = document.createElement("div");
  displayEl.className = "keypad-display";
  displayEl.textContent = "";
  wrapEl.appendChild(displayEl);

  const grid = document.createElement("div");
  grid.className = "keypad-grid";
  KEYS.forEach((k) => {
    const b = document.createElement("button");
    b.className =
      "key-btn" + (k === "🔔" ? " key-bell" : "") + (k === "✓" ? " key-enter" : "");
    b.textContent = k;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onKey(k, b);
    });
    grid.appendChild(b);
  });
  wrapEl.appendChild(grid);
  gameEl.appendChild(wrapEl);

  if (onReady) onReady();
}

function onKey(k, btn) {
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 130);

  if (k === "✓") {
    celebrate();
    clearDisplay();
    return;
  }
  if (k === "🔔") {
    playDing();
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
  if (wrapEl) {
    wrapEl.remove();
    wrapEl = null;
  }
  document.querySelectorAll(".keypad-celebrate, .sparkle").forEach((el) => el.remove());
  displayEl = null;
  pressCount = 0;
}
