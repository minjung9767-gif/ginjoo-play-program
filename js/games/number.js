// 🔢 숫자 놀이: "동물 친구 밥 주기" (카메라 불필요)
// - 동물이 "뼈다귀 두 개 주세요~" 하고 부탁하면, 아이가 먹이를 톡톡 눌러 입에 쏙 넣어준다.
// - 하나 줄 때마다 엄마 목소리로 "하나!", "둘!" 하고 세어 주고, 소리도 한 음씩 올라간다.
// - 틀린 게 없다: 덜 주면 "하나 더 줄래?", 더 주면 "우와, 많이 먹었다!" 하고 웃는다.
// - 동물 다섯 마리를 먹이면 다 같이 춤추며 마무리하고, 새 판이 이어진다.
// - 녹음 파일(assets/numbers/…)이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
import { ANIMALS, ANIMALS_PER_ROUND, MAX_COUNT, COUNT_WORDS, ASK_WORDS, NUM_PHRASES } from "../numbers.js";
import { speakText, stopSpeech, ttsSupported } from "../speech.js";
import { isMuted, playCorrect, playCountNote, playPeekaboo, resumeAudio } from "../audio.js";

const IDLE_MS = 6000;       // 이만큼 가만히 있으면 먹이를 살랑 흔들어 "눌러봐~" 하고 알려줌
const MAX_IDLE_TALKS = 2;   // 동물 한 마리당 다시 말해 주는 횟수 (너무 재촉하지 않게)

let wrapEl = null;
let bubbleEl = null;
let animalEl = null;
let pipsEl = null;
let foodsEl = null;
let partyEl = null;
let running = false;

let lineup = [];        // 이번 판에 나올 동물 순서
let lineIdx = 0;
let animal = null;      // 지금 밥 주는 동물
let target = 0;         // 달라고 한 개수
let lastTarget = 0;
let fed = 0;            // 지금까지 준 개수
let done = false;       // 달라고 한 만큼 다 줬는지 (그 뒤로 더 줘도 됨)

let roundId = 0;        // 동물이 바뀌면 +1 → 지난 동물의 진행을 무효화
let sayId = 0;          // 말하기 세션 번호 → 아이가 탭하면 지금 말하던 걸 끊는다
let leaveToken = 0;     // 다음 동물로 넘어가기 예약 번호 (탭하면 다시 예약)
let idleTimer = null;
let idleTalks = 0;
let audioEl = null;
let keepAlive = null;
let kickAudio = null;

export async function startNumber(videoEl, canvasEl, onReady) {
  const gameEl = document.getElementById("game");
  gameEl.classList.add("num-mode");
  running = true;
  lastTarget = 0;

  wrapEl = document.createElement("div");
  wrapEl.className = "num-wrap";
  wrapEl.innerHTML =
    '<div class="word-bubbles" aria-hidden="true">' +
    '  <span class="float-bubble b1"></span><span class="float-bubble b3"></span>' +
    '  <span class="float-bubble b5"></span><span class="float-bubble b7"></span>' +
    "</div>" +
    '<div class="num-bubble"></div>' +
    '<div class="num-animal"></div>' +
    '<div class="num-pips" aria-hidden="true"></div>' +
    '<div class="num-foods"></div>' +
    '<div class="num-party hidden" aria-hidden="true"></div>';
  gameEl.appendChild(wrapEl);
  bubbleEl = wrapEl.querySelector(".num-bubble");
  animalEl = wrapEl.querySelector(".num-animal");
  pipsEl = wrapEl.querySelector(".num-pips");
  foodsEl = wrapEl.querySelector(".num-foods");
  partyEl = wrapEl.querySelector(".num-party");

  ANIMALS.forEach((a) => {
    if (a.img) new Image().src = a.img;
  });

  // 크롬 등에서 자동 음성이 몇 초 뒤 저절로 멈추는 걸 막는다 (낱말놀이와 같은 대응)
  if ("speechSynthesis" in window) {
    keepAlive = setInterval(() => {
      try {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) return;
        speechSynthesis.resume();
      } catch (_) {}
    }, 4000);
  }
  // 탭할 때마다 오디오를 다시 깨운다 (iOS에서 자동음성 뒤 효과음이 꺼지는 현상 방지)
  kickAudio = () => {
    try {
      resumeAudio();
    } catch (_) {}
  };
  document.addEventListener("pointerdown", kickAudio, true);

  if (onReady) onReady();
  newLineup();
  nextAnimal();
}

export function stopNumber() {
  running = false;
  roundId++;
  sayId++;
  leaveToken++;
  clearIdle();
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
  if (kickAudio) {
    document.removeEventListener("pointerdown", kickAudio, true);
    kickAudio = null;
  }
  stopSpeech();
  stopRecorded();
  const gameEl = document.getElementById("game");
  if (gameEl) gameEl.classList.remove("num-mode");
  if (wrapEl) {
    wrapEl.remove();
    wrapEl = null;
  }
  bubbleEl = animalEl = pipsEl = foodsEl = partyEl = null;
  animal = null;
}

/* ===== 한 판(동물 다섯 마리) 순서 정하기 ===== */
function newLineup() {
  // 섞어서 순서대로 (동물이 다섯보다 적으면 한 바퀴 돌고 다시)
  const pool = shuffle(ANIMALS);
  lineup = [];
  while (lineup.length < ANIMALS_PER_ROUND) lineup.push(pool[lineup.length % pool.length]);
  lineIdx = 0;
}

/* ===== 다음 동물 등장 ===== */
function nextAnimal() {
  if (!running) return;
  interrupt();
  clearIdle();
  roundId++;
  leaveToken++;
  const t = roundId;

  if (lineIdx >= lineup.length) {
    party();
    return;
  }
  animal = lineup[lineIdx++];
  target = pickCount();
  fed = 0;
  done = false;
  idleTalks = 0;

  renderBubble();
  renderAnimal();
  renderPips();
  renderFoods();

  // 동물이 먼저 눈에 들어오게 살짝 뜸을 들였다가 부탁
  delay(500).then(() => {
    if (!running || t !== roundId) return;
    say(askSegs()).then(() => {
      if (running && t === roundId) startIdle();
    });
  });
}

function pickCount() {
  let n = 1 + Math.floor(Math.random() * MAX_COUNT);
  if (MAX_COUNT > 1) {
    while (n === lastTarget) n = 1 + Math.floor(Math.random() * MAX_COUNT);
  }
  lastTarget = n;
  return n;
}

// "멍멍! 뼈다귀 두 개 주세요~"
function askSegs() {
  return [animal.cry, animal.food, ASK_WORDS[target - 1]];
}

/* ===== 그리기 ===== */
function renderBubble() {
  // 글자와 함께 먹이 그림을 개수만큼 보여준다 (눈으로도 개수를 보게)
  bubbleEl.innerHTML = "";
  const icons = document.createElement("span");
  icons.className = "nb-icons";
  icons.textContent = animal.food.art.repeat(target);
  const txt = document.createElement("span");
  txt.className = "nb-text";
  txt.textContent = `${animal.food.text} ${ASK_WORDS[target - 1].label} 주세요!`;
  bubbleEl.append(icons, txt);
  replay(bubbleEl, "pop-in");
}

function renderAnimal() {
  animalEl.innerHTML = "";
  animalEl.className = "num-animal";
  animalEl.appendChild(makeArt(animal));
  replay(animalEl, "enter");
}

function renderPips() {
  pipsEl.innerHTML = "";
  for (let i = 0; i < target; i++) {
    const p = document.createElement("span");
    p.className = "np-pip";
    pipsEl.appendChild(p);
  }
}

function renderFoods() {
  foodsEl.innerHTML = "";
  // 달라는 것보다 하나 더 놓아둔다 → 다 누르면 끝나는 게 아니라 '세어서' 주게, 더 줘도 괜찮게
  const count = target + 1;
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.className = "num-food";
    btn.type = "button";
    btn.textContent = animal.food.art;
    btn.setAttribute("aria-label", animal.food.text);
    btn.style.animationDelay = (i * 0.08).toFixed(2) + "s";
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onFeed(btn);
    });
    foodsEl.appendChild(btn);
  }
}

/* 동물 그림: 사진이 있으면 사진, 없거나 못 불러오면 이모지로 */
function makeArt(a) {
  const box = document.createElement("span");
  box.className = "na-art";
  if (!a.img) {
    box.textContent = a.art;
    return box;
  }
  const im = document.createElement("img");
  im.src = a.img;
  im.alt = a.name;
  im.decoding = "async";
  im.addEventListener("error", () => {
    box.classList.remove("has-img");
    box.textContent = a.art;
  });
  box.classList.add("has-img");
  box.appendChild(im);
  return box;
}

/* ===== 먹이를 줬을 때 ===== */
function onFeed(btn) {
  if (!running || !animal || btn.classList.contains("eaten")) return;
  const t = roundId;
  btn.classList.add("eaten");
  btn.disabled = true;
  fed++;
  clearIdle();
  interrupt();
  flyToMouth(btn);

  // 입에 들어갈 즈음 냠! + 한 음 올라가는 소리
  const n = fed;
  delay(380).then(() => {
    if (!running || t !== roundId) return;
    playCountNote(n);
    replay(animalEl, "chomp");
    fillPip(n);
  });

  const count = COUNT_WORDS[Math.min(n, COUNT_WORDS.length) - 1];
  let talk;
  if (n < target) {
    talk = say([count]);
    talk.then(() => {
      if (running && t === roundId) startIdle();
    });
    return;
  }

  if (n === target) {
    done = true;
    delay(380).then(() => {
      if (!running || t !== roundId) return;
      playCorrect();
      animalEl.classList.add("happy");
    });
    talk = say([count, NUM_PHRASES.thanks]);
  } else {
    // 더 줬어요 → 야단 없이 즐겁게
    talk = say([count, NUM_PHRASES.lots]);
  }

  // 말이 끝나고 잠깐 쉬었다가 다음 동물로 (그 사이 또 주면 다시 기다림)
  const token = ++leaveToken;
  talk
    .then(() => delay(900))
    .then(() => {
      if (running && t === roundId && token === leaveToken) nextAnimal();
    });
}

// 먹이가 동물 입으로 날아가는 움직임
function flyToMouth(btn) {
  if (!animalEl) return;
  const from = btn.getBoundingClientRect();
  const to = animalEl.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height * 0.6 - (from.top + from.height / 2);
  if (!btn.animate) return; // 아주 오래된 브라우저는 그냥 사라지게(CSS)
  btn.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.9)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
    ],
    { duration: 420, easing: "ease-in", fill: "forwards" }
  );
}

// 하나 줄 때마다 동그라미가 하나씩 채워지고, 더 주면 별이 붙는다
function fillPip(n) {
  if (!pipsEl) return;
  if (n <= target) {
    const p = pipsEl.children[n - 1];
    if (p) p.classList.add("on");
  } else {
    const s = document.createElement("span");
    s.className = "np-pip extra on";
    s.textContent = "⭐";
    pipsEl.appendChild(s);
  }
}

/* ===== 가만히 있을 때: 먹이 살랑 + 가끔 다시 말해 주기 ===== */
function startIdle() {
  clearIdle();
  if (!running || done) return;
  const t = roundId;
  idleTimer = setTimeout(() => {
    if (!running || t !== roundId || done) return;
    const next = foodsEl && foodsEl.querySelector(".num-food:not(.eaten)");
    if (next) replay(next, "nudge");
    if (idleTalks < MAX_IDLE_TALKS) {
      idleTalks++;
      const segs = fed > 0 ? [NUM_PHRASES.more] : askSegs();
      say(segs).then(() => {
        if (running && t === roundId) startIdle();
      });
    } else {
      startIdle(); // 말은 그만하고 살랑살랑만 계속
    }
  }, IDLE_MS);
}

function clearIdle() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/* ===== 한 판 끝: 다 같이 춤추기 ===== */
async function party() {
  const t = roundId;
  animal = null;
  bubbleEl.innerHTML = "";
  animalEl.innerHTML = "";
  animalEl.className = "num-animal";
  pipsEl.innerHTML = "";
  foodsEl.innerHTML = "";

  const seen = [];
  lineup.forEach((a) => {
    if (!seen.includes(a)) seen.push(a);
  });
  const stars = ["⭐", "✨", "🎉", "🌟", "💫", "⭐", "✨", "🎊"];
  partyEl.innerHTML =
    '<div class="np-cheer">다 먹었다!</div>' +
    '<div class="np-dancers"></div>' +
    stars
      .map((b, i) => {
        const left = 8 + (i * 84) / stars.length + (Math.random() * 6 - 3);
        const d = (Math.random() * 0.4).toFixed(2);
        const dur = (1.2 + Math.random() * 0.8).toFixed(2);
        return `<span class="wc-star" style="left:${left.toFixed(1)}%;animation-delay:${d}s;animation-duration:${dur}s">${b}</span>`;
      })
      .join("");
  const dancers = partyEl.querySelector(".np-dancers");
  seen.forEach((a, i) => {
    const art = makeArt(a);
    art.classList.add("np-dancer");
    art.style.animationDelay = (i * 0.12).toFixed(2) + "s";
    dancers.appendChild(art);
  });
  partyEl.classList.remove("hidden");
  playPeekaboo();

  await say([NUM_PHRASES.finish]);
  await delay(2200);
  if (!running || t !== roundId) return;
  partyEl.classList.add("hidden");
  partyEl.innerHTML = "";
  newLineup();
  nextAnimal();
}

/* ===== 말하기: 녹음 파일이 있으면 그걸, 없으면 자동 음성(TTS) =====
   (낱말놀이와 같은 방식. 자동 음성이 '끝' 신호를 안 줘도 멈추지 않게 최대 대기 시간을 둔다) */
async function say(segList) {
  const id = ++sayId;
  for (const seg of segList) {
    if (!seg) continue;
    if (!running || id !== sayId) return false;
    let played = false;
    if (seg.audio) {
      const r = await withTimeout(playRecorded(seg.audio), 10000);
      if (!running || id !== sayId) return false;
      played = r === true;
    }
    if (!played && seg.text != null && ttsSupported()) {
      await withTimeout(
        speakText(seg.text, { rate: 0.9, volume: 1, muted: isMuted }),
        estimateSpeechMs(seg.text)
      );
      if (!running || id !== sayId) return false;
    }
  }
  return true;
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const t = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve("timeout");
      }
    }, ms);
    Promise.resolve(promise).then(
      (v) => {
        if (!settled) {
          settled = true;
          clearTimeout(t);
          resolve(v);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(t);
          resolve("error");
        }
      }
    );
  });
}

function estimateSpeechMs(text) {
  const len = text ? text.length : 0;
  return Math.min(6000, 900 + len * 180);
}

function interrupt() {
  sayId++;
  stopSpeech();
  stopRecorded();
}

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

/* ===== 유틸 ===== */
// 같은 애니메이션을 다시 틀기 (클래스를 뗐다 붙임)
function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
