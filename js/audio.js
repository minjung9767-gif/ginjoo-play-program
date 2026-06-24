// Web Audio API로 배경 멜로디 + 효과음 합성 (외부 음원 파일 불필요)
let ctx = null;
let masterGain = null;
let melodyTimer = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

// 사용자 제스처 시점에 호출 (자동재생 정책 회피)
export async function resumeAudio() {
  ensureCtx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

// 단일 음 재생 (벨/실로폰 느낌)
function playNote(freq, startTime, duration, gainVal = 0.25, type = "triangle") {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(gainVal, startTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(g);
  g.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// 경쾌하고 통통 튀는 멜로디 (C 메이저, I–vi–IV–V 진행 / 영상통화 징글 느낌)
// null = 쉼표. 빠른 스타카토로 바운스감을 줌.
const STEP = 0.16; // 한 스텝 길이 (빠른 8분음표)
// prettier-ignore
const MELODY = [
  783.99, null, 659.25, 783.99, 1046.50, null, 783.99, null, // C : G5 . E5 G5 C6 . G5 .
  880.00, null, 659.25, 880.00, 1046.50, null, 880.00, null, // Am: A5 . E5 A5 C6 . A5 .
  880.00, null, 698.46, 880.00, 1046.50, null, 880.00, null, // F : A5 . F5 A5 C6 . A5 .
  987.77, null, 783.99, 1174.66, 987.77, null, 783.99, null, // G : B5 . G5 D6 B5 . G5 .
];
// 베이스: 각 마디(8스텝)의 0,4 스텝에서 울림 (둥둥 바운스)
// prettier-ignore
const BASS = [
  { step: 0,  freq: 130.81 }, { step: 4,  freq: 196.00 }, // C3 / G3
  { step: 8,  freq: 110.00 }, { step: 12, freq: 164.81 }, // A2 / E3
  { step: 16, freq: 87.31 },  { step: 20, freq: 130.81 }, // F2 / C3
  { step: 24, freq: 98.00 },  { step: 28, freq: 146.83 }, // G2 / D3
];
const TOTAL_STEPS = 32;

function scheduleMelodyLoop() {
  if (!ctx || muted) return;
  const now = ctx.currentTime + 0.05;
  // 멜로디 (밝은 벨, 스타카토)
  MELODY.forEach((freq, i) => {
    if (freq) playNote(freq, now + i * STEP, STEP * 0.7, 0.16, "triangle");
  });
  // 베이스 (둥근 저음, 살짝 길게)
  BASS.forEach(({ step, freq }) => {
    playNote(freq, now + step * STEP, STEP * 2.2, 0.13, "sine");
  });
  const loopMs = TOTAL_STEPS * STEP * 1000;
  melodyTimer = setTimeout(scheduleMelodyLoop, loopMs);
}

export function startMelody() {
  ensureCtx();
  stopMelody();
  if (!muted) scheduleMelodyLoop();
}

export function stopMelody() {
  if (melodyTimer) {
    clearTimeout(melodyTimer);
    melodyTimer = null;
  }
}

// 화면 터치 시 효과음 (반짝 올라가는 소리)
export function playSparkle() {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const notes = [659.25, 880.0, 1174.66]; // E5 A5 D6
  notes.forEach((f, i) => playNote(f, now + i * 0.06, 0.22, 0.22, "sine"));
}

export function toggleMute() {
  muted = !muted;
  if (muted) {
    stopMelody();
    if (masterGain) masterGain.gain.value = 0;
  } else {
    if (masterGain) masterGain.gain.value = 0.6;
    startMelody();
  }
  return muted;
}

export function isMuted() {
  return muted;
}
