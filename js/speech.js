// 자동 음성(TTS) 엔진: 브라우저 내장 음성으로 글을 읽어 준다 (음원 파일 불필요).
// - 긴 글을 한 번에 읽으면 일부 브라우저에서 중간에 끊기므로, 문장 단위로 나눠서 차례로 읽는다.
// - 멈춤은 speechSynthesis.pause()가 기기마다 불안정해서,
//   "지금 문장 번호를 기억해 두고 취소 → 다시 그 문장부터 읽기" 방식으로 구현한다.

let koVoice = null;

function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  // 한국어 음성 우선 (Google/기기 내장 순서는 브라우저가 알아서 정렬)
  koVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ko")) || null;
}

if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function ttsSupported() {
  return "speechSynthesis" in window;
}

// 현재 읽는 중인 세션 (한 번에 하나만)
let current = null; // { sentences, idx, opts, resolve, cancelled, paused }

function splitSentences(text) {
  const m = text.match(/[^.!?…]+[.!?…]*/g);
  const list = m ? m.map((s) => s.trim()).filter(Boolean) : [];
  return list.length ? list : [text];
}

// 글을 읽기 시작한다. 다 읽으면 { finished: true }, 중간에 취소되면 { finished: false }.
// opts: { rate, volume, muted }  (muted는 함수 — 문장마다 음소거 여부를 다시 확인)
export function speakText(text, opts = {}) {
  stopSpeech();
  if (!ttsSupported()) return Promise.resolve({ finished: false });
  const sentences = splitSentences(text);
  return new Promise((resolve) => {
    current = { sentences, idx: 0, opts, resolve, cancelled: false, paused: false };
    speakNext();
  });
}

function speakNext() {
  const s = current;
  if (!s || s.cancelled || s.paused) return;
  if (s.idx >= s.sentences.length) {
    current = null;
    s.resolve({ finished: true });
    return;
  }
  const u = new SpeechSynthesisUtterance(s.sentences[s.idx]);
  u.lang = "ko-KR";
  if (koVoice) u.voice = koVoice;
  u.rate = s.opts.rate != null ? s.opts.rate : 0.9;
  u.pitch = 1.0;
  const mutedNow = typeof s.opts.muted === "function" && s.opts.muted();
  u.volume = mutedNow ? 0 : s.opts.volume != null ? s.opts.volume : 1;
  const advance = () => {
    // 취소/멈춤으로 끝난 경우엔 다음 문장으로 넘어가지 않는다
    if (current !== s || s.cancelled || s.paused) return;
    s.idx++;
    setTimeout(speakNext, 250); // 문장 사이 짧은 숨 고르기
  };
  u.onend = advance;
  u.onerror = advance;
  speechSynthesis.speak(u);
}

// 잠깐 멈춤 (지금 읽던 문장부터 다시 시작할 수 있게 기억해 둠)
export function pauseSpeech() {
  if (!current || current.paused) return;
  current.paused = true;
  speechSynthesis.cancel();
}

// 멈췄던 곳(문장)부터 이어서 읽기
export function resumeSpeech() {
  if (!current || !current.paused) return;
  current.paused = false;
  setTimeout(speakNext, 100);
}

// 멈춰 있는 읽기 세션이 있는지 (이어 읽기 가능 여부)
export function hasPausedSpeech() {
  return !!(current && current.paused);
}

// 완전히 중단 (놀이 종료 등)
export function stopSpeech() {
  if (current) {
    const s = current;
    s.cancelled = true;
    current = null;
    s.resolve({ finished: false });
  }
  if (ttsSupported()) speechSynthesis.cancel();
}
