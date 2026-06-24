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

// 밝고 통통 튀는 짧은 멜로디 (C 메이저 펜타토닉)
const MELODY = [
  523.25, 587.33, 659.25, 783.99, // C5 D5 E5 G5
  659.25, 587.33, 523.25, 440.0,  // E5 D5 C5 A4
  523.25, 659.25, 783.99, 880.0,  // C5 E5 G5 A5
  783.99, 659.25, 587.33, 523.25, // G5 E5 D5 C5
];

function scheduleMelodyLoop() {
  if (!ctx || muted) return;
  const beat = 0.36; // 한 음 길이
  const now = ctx.currentTime + 0.05;
  MELODY.forEach((freq, i) => {
    playNote(freq, now + i * beat, beat * 0.9, 0.18, "triangle");
  });
  const loopMs = MELODY.length * beat * 1000;
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
