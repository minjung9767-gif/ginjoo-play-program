// 화면 전환 + 카메라/오디오/게임 수명주기 관리
import { startCamera, stopCamera } from "./camera.js";
import { startMirror, stopMirror } from "./games/mirror.js";
import { resumeAudio, startMelody, stopMelody, toggleMute, isMuted } from "./audio.js";

const homeScreen = document.getElementById("home");
const gameScreen = document.getElementById("game");
const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const statusOverlay = document.getElementById("status");
const statusText = document.getElementById("statusText");
const muteBtn = document.getElementById("muteBtn");
const homeBtn = document.getElementById("homeBtn");

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
  if (game !== "mirror") return; // 1차에는 매직 거울만
  currentGame = game;

  showScreen(gameScreen);
  setStatus("카메라를 준비하고 있어요...", true);

  // 사용자 제스처(버튼 클릭) 시점에 오디오 활성화
  try {
    await resumeAudio();
    startMelody();
    muteBtn.textContent = isMuted() ? "🔇" : "🔊";
  } catch (_) {}

  try {
    await startCamera(video);
  } catch (err) {
    setStatus("카메라를 사용할 수 없어요. 카메라 권한을 허용해 주세요. 🥲", true);
    return;
  }

  try {
    setStatus("마법 거울을 준비하고 있어요... ✨", true);
    await startMirror(video, canvas, () => setStatus("", false));
  } catch (err) {
    console.error(err);
    setStatus("앗, 마법 거울을 불러오지 못했어요. 인터넷 연결을 확인해 주세요. 🥲", true);
  }
}

function exitGame() {
  if (currentGame === "mirror") {
    stopMirror(video, canvas);
  }
  stopCamera(video);
  stopMelody();
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
  muteBtn.textContent = muted ? "🔇" : "🔊";
});

// 시작 화면 표시
showScreen(homeScreen);
