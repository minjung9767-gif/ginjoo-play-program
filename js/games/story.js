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
let randomMode = false; // 🎲 랜덤 자동 재생 중인지
let playlist = [];      // 랜덤 재생 목록 (엄마·아빠 녹음 이야기만, 섞인 순서)
let playIdx = 0;        // 지금 재생 중인 목록 위치
let lastRandomStartId = null; // 지난번 랜덤 시작 이야기 (다음엔 다른 걸로 시작하려고 기억)

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
  randomMode = false;
  playlist = [];
  playIdx = 0;
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
  randomMode = false;
  playlist = [];
  playIdx = 0;
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
      `<span class="story-card-kind">${st.kind}</span>` +
      voiceBadge(st);
    b.addEventListener("click", () => beginStory(st));
    grid.appendChild(b);
  });
  box.appendChild(grid);

  // 🎲 랜덤 버튼: 엄마·아빠 녹음 이야기만 순서 섞어 계속 재생
  const recorded = STORIES.filter((s) => s.voice);
  if (recorded.length) {
    const rnd = document.createElement("button");
    rnd.className = "story-random-btn";
    rnd.innerHTML =
      '<span class="rnd-ico">🎲</span>' +
      '<span class="rnd-body"><span class="rnd-txt">랜덤으로 듣기</span>' +
      '<span class="rnd-sub">엄마·아빠 목소리 이야기를 순서 섞어 계속 들려줘요</span></span>';
    rnd.addEventListener("click", startRandom);
    box.appendChild(rnd);
  }

  if (!ttsSupported()) {
    const warn = document.createElement("p");
    warn.className = "story-tts-warn";
    warn.textContent = "이 브라우저는 자동 읽어주기가 안 돼요. 글을 보며 직접 읽어 주세요. (화면을 누르면 다음 장면)";
    box.appendChild(warn);
  }

  contentEl.appendChild(box);
}

// 누가 읽어주는지 배지 (엄마/아빠 = 녹음 목소리, 없으면 자동 음성)
function voiceBadge(st) {
  if (st.voice === "엄마")
    return '<span class="voice-badge voice-mom">🎤 엄마 목소리</span>';
  if (st.voice === "아빠")
    return '<span class="voice-badge voice-dad">🎤 아빠 목소리</span>';
  return '<span class="voice-badge voice-auto">🔊 자동 목소리</span>';
}

/* ===== 🎲 랜덤 자동 재생 (엄마·아빠 녹음 이야기만) ===== */
function startRandom() {
  const recorded = STORIES.filter((s) => s.voice);
  if (!recorded.length) return;
  playlist = shuffle(recorded);
  // 누를 때마다 첫 이야기가 지난번과 다르도록 (같으면 뒤의 다른 이야기와 자리 교체)
  if (playlist.length > 1 && playlist[0].id === lastRandomStartId) {
    const swapWith = 1 + Math.floor(Math.random() * (playlist.length - 1));
    [playlist[0], playlist[swapWith]] = [playlist[swapWith], playlist[0]];
  }
  lastRandomStartId = playlist[0].id;
  playIdx = 0;
  randomMode = true;
  beginStory(playlist[0]);
}

// 랜덤 재생 중 "다음 이야기" 버튼: 지금 이야기를 멈추고 바로 다음 이야기로
function skipToNextStory() {
  if (!running || !randomMode) return;
  stopSpeech();
  stopRecorded();
  paused = false;
  stalledNext = -1;
  playNextInPlaylist();
}

// 한 편이 끝나면 목록의 다음 편으로. 다 돌면 다시 섞어서 계속 (틀어놓기용)
function playNextInPlaylist() {
  playIdx++;
  if (playIdx >= playlist.length) {
    const last = playlist[playlist.length - 1];
    playlist = shuffle(playlist);
    // 바로 같은 이야기가 연달아 나오지 않게
    if (playlist.length > 1 && playlist[0] === last) playlist.push(playlist.shift());
    playIdx = 0;
  }
  beginStory(playlist[playIdx]);
}

// Fisher-Yates 섞기 (원본은 그대로, 섞인 새 배열 반환)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    (randomMode
      ? '  <button class="story-ctrl story-nextstory" aria-label="다음 이야기" title="다음 이야기"><span class="ctrl-ico">⏭️</span><span class="ctrl-cap">다음 이야기</span></button>' +
        '  <span class="story-random-chip">🎲 랜덤 재생 중</span>'
      : "") +
    "</div>" +
    '<button class="story-nav story-prev" aria-label="이전 장면">❮</button>' +
    '<button class="story-nav story-next" aria-label="다음 장면">❯</button>' +
    '<div class="story-art"></div>' +
    '<p class="story-text"></p>' +
    '<div class="story-dots"></div>' +
    '<div class="story-paused-overlay hidden">' +
    '  <div class="sp-moon">🌙</div>' +
    '  <div class="sp-text">잠깐 쉬는 중이에요</div>' +
    '  <div class="sp-sub">화면을 누르면 이어서 읽어 줄게요</div>' +
    "</div>" +
    `<div class="story-hint">${ttsSupported() ? "화면을 누르거나 스페이스바로 잠깐 멈춰요 · ‹ › 로 앞뒤 장면" : "화면을 누르면 다음 장면으로 넘어가요"}</div>`;

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
  // 랜덤 재생 중에만 있는 "다음 이야기" 버튼 (다른 이야기로 건너뛰기)
  const nextStoryBtn = stageEl.querySelector(".story-nextstory");
  if (nextStoryBtn) {
    nextStoryBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      skipToNextStory();
    });
  }
  // 좌우 이전/다음 화살표
  stageEl.querySelector(".story-prev").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    prevScene();
  });
  stageEl.querySelector(".story-next").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    nextScene();
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

// 이전/다음 장면으로 (소리를 안 기다리고 바로 이동)
function goToScene(i) {
  if (!running || !story) return;
  const target = Math.max(0, Math.min(i, story.scenes.length - 1));
  stopSpeech();
  stopRecorded();
  paused = false;
  stalledNext = -1;
  togglePausedOverlay(false);
  playScene(target);
}
function prevScene() {
  if (!running || !story) return;
  if (currentScene <= 0) return; // 첫 장면이면 무시
  goToScene(currentScene - 1);
}
function nextScene() {
  if (!running || !story) return;
  if (currentScene >= story.scenes.length - 1) {
    // 마지막 장면에서 다음 → 끝 (랜덤이면 다음 이야기)
    stopSpeech();
    stopRecorded();
    showEnd();
    return;
  }
  goToScene(currentScene + 1);
}

function onKeyDown(e) {
  if (!story) return; // 이야기 고르기 화면에선 무시
  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    togglePause();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    prevScene();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    nextScene();
  }
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
  // 첫 장면에선 '이전' 화살표 흐리게(비활성)
  const prevBtn = stageEl.querySelector(".story-prev");
  if (prevBtn) prevBtn.disabled = i === 0;

  const finished = await speakScene(sc);
  if (!running || token !== sceneToken || !finished) return;

  // 장면 사이 잠깐 숨 고르기 (소리만 들을 때 답답하지 않게 짧게)
  await delay(500);
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
  // 🎲 랜덤 재생 중이면 끝 화면 대신 다음 이야기로 이어감
  if (randomMode) {
    playNextInPlaylist();
    return;
  }
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
