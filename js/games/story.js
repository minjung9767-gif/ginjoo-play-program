// 🌙 잠자리 동화: 어두운 밤 화면에서 동화를 잔잔하게 읽어 주는 놀이 (카메라 불필요).
// - 이야기를 고르면 장면(그림+글)을 자동 음성이 차례로 읽어 준다.
// - 화면을 톡 누르면 잠깐 멈추고(아기와 이야기 나누는 시간), 다시 누르면 이어서 읽는다.
// - 자동 음성이 안 되는 브라우저에서는 글을 직접 읽어 주고, 누르면 다음 장면으로 넘어간다.
import { STORIES } from "../stories.js";
import {
  speakText,
  pauseSpeech,
  resumeSpeech,
  stopSpeech,
  hasPausedSpeech,
  ttsSupported,
} from "../speech.js";
import { isMuted } from "../audio.js";

let wrapEl = null;
let contentEl = null;
let stageEl = null;
let running = false;
let paused = false;
let story = null;
let currentScene = 0;
let sceneToken = 0;   // 장면이 바뀌면 +1 → 이전 장면의 자동 진행을 무효화
let stalledNext = -1; // 장면 사이 쉬는 틈에 멈췄을 때, 다시 시작할 장면 번호
let audioEl = null;   // 녹음 음성 파일 재생용 (scene.audio가 있을 때)

export async function startStory(videoEl, canvasEl, onReady) {
  const gameEl = document.getElementById("game");
  gameEl.classList.add("story-mode");
  running = true;
  paused = false;
  story = null;

  document.addEventListener("keydown", onKeyDown);

  wrapEl = document.createElement("div");
  wrapEl.className = "story-wrap";
  makeStars(wrapEl, 36);

  contentEl = document.createElement("div");
  contentEl.className = "story-content";
  wrapEl.appendChild(contentEl);

  gameEl.appendChild(wrapEl);
  renderPicker();
  if (onReady) onReady();
}

export function stopStory() {
  running = false;
  sceneToken++;
  story = null;
  paused = false;
  stalledNext = -1;
  document.removeEventListener("keydown", onKeyDown);
  stopSpeech();
  stopRecorded();
  const gameEl = document.getElementById("game");
  if (gameEl) gameEl.classList.remove("story-mode");
  if (wrapEl) {
    wrapEl.remove();
    wrapEl = null;
  }
  contentEl = null;
  stageEl = null;
}

/* ===== 밤하늘 별 (은은하게 깜빡이는 장식) ===== */
function makeStars(parent, n) {
  const sky = document.createElement("div");
  sky.className = "story-sky";
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
    sky.appendChild(s);
  }
  parent.appendChild(sky);
}

function clearContent() {
  if (contentEl) contentEl.innerHTML = "";
  stageEl = null;
}

/* ===== 이야기 고르기 화면 ===== */
function renderPicker() {
  sceneToken++;
  stopSpeech();
  stopRecorded();
  story = null;
  paused = false;
  stalledNext = -1;
  clearContent();

  const box = document.createElement("div");
  box.className = "story-picker";

  const title = document.createElement("h2");
  title.className = "story-picker-title";
  title.textContent = "오늘 밤엔 어떤 이야기 들을까?";
  box.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "story-grid";
  STORIES.forEach((st) => {
    const b = document.createElement("button");
    b.className = "story-card";
    b.innerHTML =
      `<span class="story-card-emoji">${st.emoji}</span>` +
      `<span class="story-card-title">${st.title}</span>` +
      `<span class="story-card-kind">${st.kind}</span>`;
    b.addEventListener("click", () => beginStory(st));
    grid.appendChild(b);
  });
  box.appendChild(grid);

  if (!ttsSupported()) {
    const warn = document.createElement("p");
    warn.className = "story-tts-warn";
    warn.textContent = "이 브라우저는 자동 읽어주기가 안 돼요. 글을 보며 직접 읽어 주세요. (화면을 누르면 다음 장면)";
    box.appendChild(warn);
  }

  contentEl.appendChild(box);
}

/* ===== 이야기 읽기 화면 ===== */
function beginStory(st) {
  story = st;
  paused = false;
  stalledNext = -1;
  clearContent();

  stageEl = document.createElement("div");
  stageEl.className = "story-stage";
  stageEl.innerHTML =
    '<div class="story-controls">' +
    '  <button class="story-ctrl story-back" aria-label="다른 이야기 고르기" title="다른 이야기"><span class="ctrl-ico">📚</span><span class="ctrl-cap">다른 이야기</span></button>' +
    '  <button class="story-ctrl story-pause" aria-label="멈춤/이어읽기" title="멈춤/이어읽기"><span class="ctrl-ico">⏸</span></button>' +
    "</div>" +
    '<div class="story-art"></div>' +
    '<p class="story-text"></p>' +
    '<div class="story-dots"></div>' +
    '<div class="story-paused-overlay hidden">' +
    '  <div class="sp-moon">🌙</div>' +
    '  <div class="sp-text">잠깐 쉬는 중이에요</div>' +
    '  <div class="sp-sub">화면을 누르면 이어서 읽어 줄게요</div>' +
    "</div>" +
    `<div class="story-hint">${ttsSupported() ? "화면을 누르거나 스페이스바로 잠깐 멈춰요" : "화면을 누르면 다음 장면으로 넘어가요"}</div>`;

  const dots = stageEl.querySelector(".story-dots");
  st.scenes.forEach(() => {
    const d = document.createElement("span");
    d.className = "story-dot";
    dots.appendChild(d);
  });

  // 컨트롤 버튼 (화면 탭보다 우선 처리하도록 이벤트 전파 막기)
  stageEl.querySelector(".story-back").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderPicker();
  });
  stageEl.querySelector(".story-pause").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePause();
  });

  stageEl.addEventListener("pointerdown", onStageTap);
  contentEl.appendChild(stageEl);

  // 첫 안내 문구는 잠시 보였다가 사라짐
  setTimeout(() => {
    const h = stageEl && stageEl.querySelector(".story-hint");
    if (h) h.classList.add("fade-out");
  }, 4500);

  playScene(0);
}

function onStageTap(e) {
  e.preventDefault();
  if (!running || !story) return;
  // 자동 음성이 없는 브라우저: 누르면 다음 장면 (직접 읽어주기 모드)
  if (!ttsSupported()) {
    playScene(currentScene + 1);
    return;
  }
  togglePause();
}

// 화면 멈춤 버튼 / 스페이스바 공용 토글
function togglePause() {
  if (!running || !story || !ttsSupported()) return;
  if (paused) resumeReading();
  else pauseReading();
}

function onKeyDown(e) {
  if (e.code !== "Space" && e.key !== " ") return;
  if (!story) return; // 이야기 고르기 화면에선 무시
  e.preventDefault();
  togglePause();
}

function pauseReading() {
  paused = true;
  pauseSpeech();
  if (audioEl) audioEl.pause();
  togglePausedOverlay(true);
}

function resumeReading() {
  paused = false;
  togglePausedOverlay(false);
  if (hasPausedSpeech()) {
    resumeSpeech();
  } else if (audioEl) {
    audioEl.play().catch(() => {});
  } else if (stalledNext >= 0) {
    // 장면 사이 쉬는 틈에 멈췄던 경우 → 다음 장면부터 이어서
    const next = stalledNext;
    stalledNext = -1;
    playScene(next);
  }
}

function togglePausedOverlay(show) {
  if (!stageEl) return;
  const ov = stageEl.querySelector(".story-paused-overlay");
  if (ov) ov.classList.toggle("hidden", !show);
  const ico = stageEl.querySelector(".story-pause .ctrl-ico");
  if (ico) ico.textContent = show ? "▶" : "⏸";
}

async function playScene(i) {
  if (!running || !story || !stageEl) return;
  if (i >= story.scenes.length) {
    showEnd();
    return;
  }
  currentScene = i;
  const token = ++sceneToken;
  const sc = story.scenes[i];

  // 장면 그림/글 갈아끼우고 부드럽게 등장
  const artEl = stageEl.querySelector(".story-art");
  const textEl = stageEl.querySelector(".story-text");
  artEl.classList.remove("scene-in");
  textEl.classList.remove("scene-in");
  void artEl.offsetWidth; // 리플로우로 등장 애니메이션 재시작
  artEl.textContent = sc.art;
  textEl.textContent = sc.text;
  artEl.classList.add("scene-in");
  textEl.classList.add("scene-in");
  updateDots(i);

  const finished = await speakScene(sc);
  if (!running || token !== sceneToken || !finished) return;

  // 장면 사이 잠깐 숨 고르기
  await delay(1500);
  if (!running || token !== sceneToken) return;
  if (paused) {
    stalledNext = i + 1;
    return;
  }
  playScene(i + 1);
}

// 장면 하나 읽기: 녹음 파일이 있으면 그걸 재생, 없거나 재생 실패면 자동 음성(TTS)
function speakScene(sc) {
  const tts = () => {
    if (!running || !ttsSupported()) return Promise.resolve(false); // 종료됨 / 직접 읽어주기 모드
    return speakText(sc.text, { rate: 0.85, volume: 0.95, muted: isMuted }).then((r) => r.finished);
  };
  if (sc.audio) return playRecorded(sc.audio).then((ok) => (ok ? true : tts()));
  return tts();
}

/* ===== 녹음 음성 파일 재생 (엄마 목소리) ===== */
// 끝까지 재생하면 true, 파일이 없거나 재생에 실패하면 false (→ 자동 음성으로 대체)
function playRecorded(src) {
  return new Promise((resolve) => {
    audioEl = new Audio(src);
    audioEl.muted = isMuted();
    audioEl.onended = () => {
      audioEl = null;
      resolve(true);
    };
    audioEl.onerror = () => {
      audioEl = null;
      resolve(false);
    };
    audioEl.play().catch(() => {
      // 자동재생이 막히거나 형식을 지원하지 않는 경우
      if (audioEl) {
        audioEl = null;
        resolve(false);
      }
    });
  });
}

function stopRecorded() {
  if (audioEl) {
    try {
      audioEl.pause();
    } catch (_) {}
    audioEl = null;
  }
}

function updateDots(i) {
  if (!stageEl) return;
  stageEl.querySelectorAll(".story-dot").forEach((d, k) => {
    d.classList.toggle("done", k < i);
    d.classList.toggle("now", k === i);
  });
}

/* ===== 끝 화면 ===== */
function showEnd() {
  if (!running) return;
  sceneToken++;
  story = null;
  paused = false;
  stalledNext = -1;
  clearContent();

  const end = document.createElement("div");
  end.className = "story-end";
  end.innerHTML =
    '<div class="story-end-art">😴🌙</div>' +
    '<div class="story-end-text">이야기 끝</div>' +
    '<div class="story-end-sub">잘 자요, 우리 긴주 💤</div>';
  const again = document.createElement("button");
  again.className = "story-again-btn";
  again.textContent = "📚 다른 이야기 들을래요";
  again.addEventListener("click", (e) => {
    e.stopPropagation();
    renderPicker();
  });
  end.appendChild(again);
  contentEl.appendChild(end);
  // 끝 화면은 소리 없이 글자만 (자는 아기를 깨우지 않도록)
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
