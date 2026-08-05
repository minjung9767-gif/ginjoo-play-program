// 💬 낱말놀이: 그림 2개 중 "○○ 어디 있어?" 를 듣고 골라보는 놀이 (카메라 불필요).
// - 맞게 고르면 그림이 커지면서 "이게 뭐야?" 하고 잠깐 기다렸다가(따라 말하는 틈),
//   엄마 목소리로 낱말을 알려주고 칭찬한다.
// - 녹음 파일(assets/words/…)이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
import { WORDS, PHRASES } from "../words.js";
import { speakText, stopSpeech, ttsSupported } from "../speech.js";
import { isMuted, playCorrect, playPop, playPeekaboo } from "../audio.js";

let wrapEl = null;
let cardsEl = null;
let questionEl = null;
let celebrateEl = null;
let running = false;

let cards = [];          // 현재 화면의 카드 두 개 { el, word }
let target = null;       // 이번 문제의 정답 단어
let lastTargetIdx = -1;  // 바로 전 정답(연속으로 같은 단어가 안 나오게)
let correctCount = 0;

let roundId = 0;         // 문제가 바뀌면 +1 → 지난 문제의 진행을 무효화
let sayId = 0;           // 말하기 세션 번호 → 아이가 탭하면 지금 말하던 걸 끊는다
let busy = false;        // 정답 처리 애니메이션 중이면 탭 무시
let audioEl = null;      // 녹음 파일 재생용
let keepAlive = null;    // 자동 음성이 도중에 멈추지 않게 주기적으로 깨워줌(크롬 버그 대응)

export async function startWord(videoEl, canvasEl, onReady) {
  const gameEl = document.getElementById("game");
  gameEl.classList.add("word-mode");
  running = true;
  busy = false;
  correctCount = 0;
  lastTargetIdx = -1;

  wrapEl = document.createElement("div");
  wrapEl.className = "word-wrap";
  wrapEl.innerHTML =
    '<div class="word-bubbles" aria-hidden="true">' +
    '  <span class="float-bubble b1"></span><span class="float-bubble b3"></span>' +
    '  <span class="float-bubble b5"></span><span class="float-bubble b7"></span>' +
    '  <span class="float-bubble b2"></span>' +
    "</div>" +
    '<div class="word-question"></div>' +
    '<div class="word-cards"></div>' +
    '<div class="word-celebrate hidden" aria-hidden="true"></div>';

  gameEl.appendChild(wrapEl);
  questionEl = wrapEl.querySelector(".word-question");
  cardsEl = wrapEl.querySelector(".word-cards");
  celebrateEl = wrapEl.querySelector(".word-celebrate");

  // 크롬 등에서 자동 음성이 몇 초 뒤 저절로 멈추는 걸 막는다
  if ("speechSynthesis" in window) {
    keepAlive = setInterval(() => {
      try {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) return;
        speechSynthesis.resume();
      } catch (_) {}
    }, 4000);
  }

  if (onReady) onReady();
  nextRound();
}

export function stopWord() {
  running = false;
  roundId++;
  sayId++;
  busy = false;
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
  stopSpeech();
  stopRecorded();
  const gameEl = document.getElementById("game");
  if (gameEl) gameEl.classList.remove("word-mode");
  if (wrapEl) {
    wrapEl.remove();
    wrapEl = null;
  }
  cardsEl = questionEl = celebrateEl = null;
  cards = [];
  target = null;
}

/* ===== 한 문제 시작 ===== */
function nextRound() {
  if (!running) return;
  interrupt();
  roundId++;
  busy = false;
  const t = roundId;

  target = pickTarget();
  const distractor = pickDistractor(target);
  const pair = shuffle([target, distractor]);
  renderCards(pair);
  if (questionEl) questionEl.textContent = `${target.word} 어디 있어?`;

  // 살짝 뜸을 들였다가 질문 (그림이 먼저 눈에 들어오도록)
  delay(350).then(() => {
    if (!running || t !== roundId) return;
    say([wordSeg(target), PHRASES.ask]);
  });
}

function pickTarget() {
  let i = Math.floor(Math.random() * WORDS.length);
  if (WORDS.length > 1) {
    while (i === lastTargetIdx) i = Math.floor(Math.random() * WORDS.length);
  }
  lastTargetIdx = i;
  return WORDS[i];
}

function pickDistractor(tg) {
  let d = tg;
  while (d === tg) d = WORDS[Math.floor(Math.random() * WORDS.length)];
  return d;
}

/* ===== 카드 두 개 그리기 ===== */
function renderCards(pair) {
  cardsEl.innerHTML = "";
  cards = pair.map((w) => {
    const btn = document.createElement("button");
    btn.className = "word-card";
    btn.innerHTML =
      `<span class="wc-emoji">${w.art}</span>` +
      `<span class="wc-label">${w.word}</span>`;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPick(w, btn);
    });
    cardsEl.appendChild(btn);
    return { el: btn, word: w };
  });
}

/* ===== 카드를 골랐을 때 ===== */
function onPick(word, el) {
  if (!running || busy) return;
  if (word === target) handleCorrect(el);
  else handleWrong(el);
}

async function handleCorrect(el) {
  busy = true;
  interrupt();
  const t = roundId;

  playCorrect();                             // 새 정답 효과음
  el.classList.add("correct-grow");
  el.classList.add("reveal");                // 한글 낱말 글자 바로 보이기 + 통 튀는 느낌
  cards.forEach((c) => {
    if (c.el !== el) c.el.classList.add("faded");
    c.el.disabled = true;
  });

  // 부드럽고 빠르게: 낱말만 한 번 또렷하게 알려주고 바로 다음 (기다림 짧게)
  await say([wordSeg(target, { proud: true })]); // "공룡!"
  if (!running || t !== roundId) return;

  correctCount++;
  if (correctCount % 5 === 0) {
    await celebrate();                       // 몇 문제마다 작은 칭찬 잔치 ✨
    if (!running || t !== roundId) return;
  }

  await delay(250);
  if (!running || t !== roundId) return;
  nextRound();
}

function handleWrong(el) {
  interrupt();
  playPop();
  el.classList.remove("wiggle");
  void el.offsetWidth; // 애니메이션 재시작
  el.classList.add("wiggle");
  // 야단 없이 부드럽게 — 다시 고를 수 있게 그대로 둔다
  say([PHRASES.retry]);
}

/* ===== 칭찬 잔치 (별 반짝) ===== */
async function celebrate() {
  if (!celebrateEl) return;
  const t = roundId;
  const bits = ["⭐", "✨", "🎉", "🌟", "💫", "⭐", "✨", "🎊"];
  celebrateEl.innerHTML =
    '<div class="wc-cheer">참 잘했어요!</div>' +
    bits
      .map((b, i) => {
        const left = 8 + (i * 84) / bits.length + (Math.random() * 6 - 3);
        const delayS = (Math.random() * 0.3).toFixed(2);
        const dur = (1.0 + Math.random() * 0.6).toFixed(2);
        return `<span class="wc-star" style="left:${left.toFixed(1)}%;animation-delay:${delayS}s;animation-duration:${dur}s">${b}</span>`;
      })
      .join("");
  celebrateEl.classList.remove("hidden");
  playPeekaboo();
  await delay(1700);
  if (celebrateEl) {
    celebrateEl.classList.add("hidden");
    celebrateEl.innerHTML = "";
  }
  void t;
}

/* ===== 말하기: 녹음 파일이 있으면 그걸, 없으면 자동 음성(TTS) =====
   segList: [{ audio?, text?, rate?, volume? }] 를 차례로 재생.
   ⚠️ 일부 브라우저는 자동 음성(TTS)이 '끝났다'는 신호를 안 줘서 그대로 멈출 수 있다.
      그래서 모든 재생은 '최대 대기 시간'을 두고, 시간이 지나면 무조건 다음으로 넘어간다. */
async function say(segList) {
  const id = ++sayId;
  for (const seg of segList) {
    if (!seg) continue;
    if (!running || id !== sayId) return false;
    let played = false;
    if (seg.audio) {
      // 녹음 파일: 재생 끝나면 넘어감(안전을 위해 최대 10초까지만 기다림)
      const r = await withTimeout(playRecorded(seg.audio, seg.volume), 10000);
      if (!running || id !== sayId) return false;
      played = r === true;
    }
    if (!played && seg.text != null && ttsSupported()) {
      // 자동 음성: 끝 신호를 못 받아도 예상 시간이 지나면 다음으로 (멈춤 방지)
      await withTimeout(
        speakText(seg.text, {
          rate: seg.rate != null ? seg.rate : 0.9,
          volume: seg.volume != null ? seg.volume : 1,
          muted: isMuted,
        }),
        estimateSpeechMs(seg.text)
      );
      if (!running || id !== sayId) return false;
    }
  }
  return true;
}

// 프라미스가 끝나거나, ms가 지나면(둘 중 먼저) 넘어간다 (자동 음성 멈춤 방지용 안전장치)
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

// 글자 길이로 자동 음성 예상 시간(ms) 대략 계산 (짧은 낱말·문구용)
function estimateSpeechMs(text) {
  const len = text ? text.length : 0;
  return Math.min(6000, 900 + len * 180);
}

// 지금 말하던 것을 즉시 끊는다 (아이가 탭했을 때 등)
function interrupt() {
  sayId++;
  stopSpeech();
  stopRecorded();
}

// 낱말 한 조각 만들기 (녹음 파일 경로 + 자동음성 대체 글자)
function wordSeg(w, opts = {}) {
  return { audio: w.audio, text: w.word, rate: opts.proud ? 0.85 : 0.9 };
}

function pickPraise() {
  const list = PHRASES.praise || [];
  if (!list.length) return { text: "잘했어요" };
  return list[Math.floor(Math.random() * list.length)];
}

/* ===== 녹음 음성 파일 재생 (엄마 목소리) =====
   끝까지 재생하면 true, 파일이 없거나 실패하면 false (→ 자동 음성으로 대체) */
function playRecorded(src, volume) {
  return new Promise((resolve) => {
    audioEl = new Audio(src);
    audioEl.muted = isMuted();
    audioEl.volume = volume != null ? volume : 1;
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
