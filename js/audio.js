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

// 따뜻하고 둥근 마림바/오르골 음색 (낮은 배음 위주, 짧고 포근한 여운)
function playBell(freq, startTime, gainVal = 0.16) {
  const partials = [
    { mult: 1, g: 1.0 },     // 기음 위주
    { mult: 2.0, g: 0.28 },  // 약한 옥타브 배음
    { mult: 3.0, g: 0.1 },   // 살짝만 (나무 두드리는 느낌)
  ];
  const dur = 0.62;
  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = p.mult === 1 ? "triangle" : "sine"; // 기음은 삼각파로 따뜻하게
    osc.frequency.value = freq * p.mult;
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.exponentialRampToValueAtTime(gainVal * p.g, startTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
  });
}

// 통통 튀는 중음역 멜로디 (C 메이저, I–V–vi–IV / 영상통화 징글 느낌).
// null = 쉼표. 편안한 중음역(F4~G5)에 도약·리듬 변화로 단조롭지 않게.
const STEP = 0.18; // 한 스텝 길이 (경쾌한 바운스)
// prettier-ignore
const MELODY = [
  659.25, 392.00, 523.25, null, 659.25, null, 587.33, null, // C : 미 솔↓ 도 · 미 · 레
  587.33, 392.00, 493.88, null, 587.33, null, 392.00, null, // G : 레 솔↓ 시 · 레 · 솔↓
  523.25, 659.25, 440.00, null, 523.25, null, 493.88, null, // Am: 도 미 라 · 도 · 시
  440.00, 523.25, 349.23, null, 392.00, null, null,   null, // F→G: 라 도 파 · 솔 (여운)
];
// 베이스: 각 마디 1·3박에 둥근 저음 (둥둥 바운스)
// prettier-ignore
const BASS = [
  { step: 0,  freq: 130.81 }, { step: 4,  freq: 196.00 }, // C : C3 / G3
  { step: 8,  freq: 98.00 },  { step: 12, freq: 146.83 }, // G : G2 / D3
  { step: 16, freq: 110.00 }, { step: 20, freq: 164.81 }, // Am: A2 / E3
  { step: 24, freq: 87.31 },  { step: 28, freq: 98.00 },  // F→G: F2 / G2
];
const TOTAL_STEPS = 32;

function scheduleMelodyLoop() {
  if (!ctx || muted) return;
  const now = ctx.currentTime + 0.05;
  // 멜로디 (따뜻한 마림바)
  MELODY.forEach((freq, i) => {
    if (freq) playBell(freq, now + i * STEP, 0.18);
  });
  // 베이스 (둥근 저음, 은은하게)
  BASS.forEach(({ step, freq }) => {
    playNote(freq, now + step * STEP, STEP * 2.0, 0.1, "sine");
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
  const notes = [523.25, 659.25, 783.99]; // 도 미 솔 (부드럽게 올라가는 차임)
  notes.forEach((f, i) => playBell(f, now + i * 0.08, 0.2));
}

// 비눗방울 터질 때 "퐁" 소리 (짧고 통통)
export function playPop() {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  // 빠르게 떨어지는 피치 → "퐁" 느낌
  const f0 = 700 + Math.random() * 300;
  osc.frequency.setValueAtTime(f0, now);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.4, now + 0.12);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);
}

// 까꿍! 등장 소리 (밝게 올라가는 차임)
export function playPeekaboo() {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // 도 미 솔 도↑
  notes.forEach((f, i) => playBell(f, now + i * 0.09, 0.22));
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
