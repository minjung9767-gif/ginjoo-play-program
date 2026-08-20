// 화면 전환 + 카메라/오디오/게임 수명주기 관리
import { startCamera, stopCamera } from "./camera.js";
import { startMirror, stopMirror } from "./games/mirror.js";
import { startMotion, stopMotion } from "./games/motion.js";
import { startKeypad, stopKeypad } from "./games/keypad.js";
import { startStory, stopStory } from "./games/story.js";
import { startWord, stopWord } from "./games/word.js";
import { resumeAudio, stopCallMusic, toggleMute, isMuted } from "./audio.js";
import { isNightMode, setNightMode, timeLabel, NIGHT_GAMES } from "./night.js";

const homeScreen = document.getElementById("home");
const gameScreen = document.getElementById("game");
const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const statusOverlay = document.getElementById("status");
const statusText = document.getElementById("statusText");
const muteBtn = document.getElementById("muteBtn");
const homeBtn = document.getElementById("homeBtn");
const nightSwitch = document.getElementById("nightSwitch");
const nightToast = document.getElementById("nightToast");
const homeStars = document.getElementById("homeStars");

// 놀이 레지스트리
const GAMES = {
  mirror: {
    start: startMirror,
    stop: stopMirror,
    loading: "영상통화를 준비하고 있어요... 📞",
    error: "앗, 영상통화를 불러오지 못했어요. 인터넷 연결을 확인해 주세요. 🥲",
  },
  motion: {
    start: startMotion,
    stop: stopMotion,
    loading: "비눗방울을 불러오고 있어요... 🫧",
    error: "앗, 비눗방울 놀이를 불러오지 못했어요. 🥲",
  },
  keypad: {
    start: startKeypad,
    stop: stopKeypad,
    needsCamera: false,
    loading: "",
    error: "앗, 키패드를 불러오지 못했어요. 🥲",
  },
  story: {
    start: startStory,
    stop: stopStory,
    needsCamera: false,
    loading: "",
    error: "앗, 동화책을 불러오지 못했어요. 🥲",
  },
  word: {
    start: startWord,
    stop: stopWord,
    needsCamera: false,
    loading: "",
    error: "앗, 낱말놀이를 불러오지 못했어요. 🥲",
  },
};

let currentGame = null;

function showScreen(el) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  el.classList.add("active");
}

function setStatus(text, visible = true) {
  statusText.textContent = text;
  statusOverlay.classList.toggle("hidden", !visible);
}

async function enterGame(game) {
  const def = GAMES[game];
  if (!def) return;
  currentGame = game;

  showScreen(gameScreen);
  // 놀이별로 컨트롤 노출을 다르게 하기 위한 표시 (예: 동화는 음소거 버튼 숨김)
  gameScreen.dataset.game = game;
  setStatus(def.needsCamera === false ? "준비하고 있어요..." : "카메라를 준비하고 있어요...", true);

  // 사용자 제스처(버튼 클릭) 시점에 오디오 활성화 (효과음용)
  try {
    await resumeAudio();
    // 동화는 음소거 버튼이 없으므로(화면을 눌러 멈추면 소리도 멈춤),
    // 다른 놀이에서 꺼둔 채로 들어와 소리가 안 나는 일이 없게 켜 준다.
    if (game === "story" && isMuted()) toggleMute();
    muteBtn.classList.toggle("muted", isMuted());
  } catch (_) {}

  // 카메라가 필요한 놀이만 카메라 시작
  if (def.needsCamera !== false) {
    try {
      await startCamera(video);
    } catch (err) {
      setStatus("카메라를 사용할 수 없어요. 카메라 권한을 허용해 주세요. 🥲", true);
      return;
    }
  }

  try {
    if (def.loading) setStatus(def.loading, true);
    await def.start(video, canvas, () => setStatus("", false));
  } catch (err) {
    console.error(err);
    setStatus(def.error, true);
  }
}

function exitGame() {
  const def = GAMES[currentGame];
  if (def) def.stop(video, canvas);
  stopCamera(video);
  stopCallMusic();
  currentGame = null;
  delete gameScreen.dataset.game;
  setStatus("", false);
  showScreen(homeScreen);
}

// 시작 화면 버튼
document.querySelectorAll(".play-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    enterGame(btn.dataset.game);
  });
});

// 부모용 컨트롤
homeBtn.addEventListener("click", exitGame);
muteBtn.addEventListener("click", () => {
  const muted = toggleMute();
  muteBtn.classList.toggle("muted", muted);
});

/* ===== 🌙 밤 모드 =====
   밤(밤 9시~새벽 6시)에는 시작 화면이 밤 버전으로 바뀌고 조용한 놀이만 남는다.
   놀이 도중에 시각이 바뀌어도 놀던 걸 끊지 않고, 시작 화면에만 반영한다. */
let nightApplied = null; // 지금 화면에 적용해 둔 상태 (같으면 다시 그리지 않음)

function applyNightMode(force) {
  const night = isNightMode();
  if (!force && night === nightApplied) return;
  nightApplied = night;
  homeScreen.classList.toggle("night", night);
  // 밤에 남길 놀이만 남기고 나머지 버튼은 감춘다 (보이면 누르니까 아예 숨김)
  document.querySelectorAll(".play-btn").forEach((b) => {
    b.classList.toggle("night-hidden", night && !NIGHT_GAMES.includes(b.dataset.game));
  });
  nightSwitch.querySelector(".ns-ico").textContent = night ? "☀️" : "🌙";
  nightSwitch.querySelector(".ns-txt").textContent = night ? "낮 모드로" : "밤 모드로";
  nightSwitch.setAttribute(
    "aria-label",
    (night ? "낮 모드로" : "밤 모드로") + " 바꾸기 (꾹 누르기)"
  );
}

// 밤하늘 별 (밤 모드 배경 장식)
function makeHomeStars(n) {
  if (!homeStars || homeStars.childElementCount) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "night-star";
    s.style.left = (Math.random() * 100).toFixed(1) + "%";
    s.style.top = (Math.random() * 100).toFixed(1) + "%";
    const size = (2 + Math.random() * 3).toFixed(1);
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.animationDelay = (Math.random() * 4).toFixed(2) + "s";
    s.style.animationDuration = (2.5 + Math.random() * 3).toFixed(2) + "s";
    homeStars.appendChild(s);
  }
}

let toastTimer = null;
function showNightToast(text) {
  nightToast.textContent = text;
  nightToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => nightToast.classList.remove("show"), 3800);
}

// 수동 스위치: 2초 꾹 눌러야 바뀐다 (아기가 툭 눌러선 안 바뀌게)
const HOLD_MS = 2000;
let holdTimer = null;

function startHold(e) {
  e.preventDefault();
  if (holdTimer) return;
  nightSwitch.classList.add("holding");
  holdTimer = setTimeout(() => {
    holdTimer = null;
    nightSwitch.classList.remove("holding");
    const now = new Date();
    const next = !isNightMode(now);
    const until = setNightMode(next, now);
    applyNightMode(true);
    showNightToast(
      (next ? "🌙 밤 모드로 바꿨어요" : "☀️ 낮 모드로 바꿨어요") +
        " · " + timeLabel(until) + "까지"
    );
  }, HOLD_MS);
}

function cancelHold() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  nightSwitch.classList.remove("holding");
}

nightSwitch.addEventListener("pointerdown", startHold);
["pointerup", "pointerleave", "pointercancel"].forEach((n) =>
  nightSwitch.addEventListener(n, cancelHold)
);

// 시각이 지나 낮↔밤이 바뀌면 시작 화면도 따라 바뀌게 (1분마다 + 화면을 다시 볼 때)
setInterval(() => applyNightMode(), 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) applyNightMode();
});
window.addEventListener("focus", () => applyNightMode());

// 시작 화면 표시
makeHomeStars(44);
applyNightMode(true);
showScreen(homeScreen);

// 밤에는 앱을 켜면 시작 화면을 거치지 않고 바로 동화 책장으로 간다
if (isNightMode()) enterGame("story");
