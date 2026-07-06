// 화면 전환 + 카메라/오디오/게임 수명주기 관리
import { startCamera, stopCamera } from "./camera.js";
import { startMirror, stopMirror } from "./games/mirror.js";
import { startMotion, stopMotion } from "./games/motion.js";
import { startKeypad, stopKeypad } from "./games/keypad.js";
import { startStory, stopStory } from "./games/story.js";
import { resumeAudio, stopCallMusic, toggleMute, isMuted } from "./audio.js";

const homeScreen = document.getElementById("home");
const gameScreen = document.getElementById("game");
const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const statusOverlay = document.getElementById("status");
const statusText = document.getElementById("statusText");
const muteBtn = document.getElementById("muteBtn");
const homeBtn = document.getElementById("homeBtn");

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
  setStatus(def.needsCamera === false ? "준비하고 있어요..." : "카메라를 준비하고 있어요...", true);

  // 사용자 제스처(버튼 클릭) 시점에 오디오 활성화 (효과음용)
  try {
    await resumeAudio();
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

// 시작 화면 표시
showScreen(homeScreen);
