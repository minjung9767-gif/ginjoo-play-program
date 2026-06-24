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

// 딩동댕 차임 음색: 기음 + 배음을 겹쳐 맑은 벨/실로폰 소리, 긴 여운
function playBell(freq, startTime, gainVal = 0.16) {
  const partials = [
    { mult: 1, g: 1.0 },
    { mult: 2.0, g: 0.5 },   // 옥타브 배음 → 종 느낌
    { mult: 3.01, g: 0.22 }, // 살짝 어긋난 배음 → 금속성 광택
  ];
  const dur = 1.1;
  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
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

// 딩동댕 차임 멜로디 (C 메이저). 벨이 맑게 울리도록 한 박씩 띄움.
// null = 쉼표. 각 마디 끝에 "딩-동-댕" 하강 차임을 배치.
const STEP = 0.22; // 한 스텝 길이 (벨이 울릴 여유)
// prettier-ignore
const MELODY = [
  523.25, null, 659.25, null, 783.99, null, 1046.50, null, // C : 도 미 솔 도↑ (딩동댕동 ↑)
  880.00, null, 1046.50, null, 783.99, 659.25, 523.25, null, // Am→ 딩(라) … 동(솔) 댕(미→도)
  698.46, null, 880.00, null, 1046.50, null, 880.00, null,  // F : 파 라 도↑ 라
  783.99, null, 659.25, null, 523.25, null, null, null,     // G→C: 딩(솔) 동(미) 댕(도) ─ 여운
];
// 베이스: 각 마디(8스텝) 첫 박에 둥근 저음 하나씩 (은은하게)
// prettier-ignore
const BASS = [
  { step: 0,  freq: 130.81 }, // C3
  { step: 8,  freq: 110.00 }, // A2
  { step: 16, freq: 87.31 },  // F2
  { step: 24, freq: 98.00 },  // G2
];
const TOTAL_STEPS = 32;

function scheduleMelodyLoop() {
  if (!ctx || muted) return;
  const now = ctx.currentTime + 0.05;
  // 멜로디 (맑은 벨/차임)
  MELODY.forEach((freq, i) => {
    if (freq) playBell(freq, now + i * STEP, 0.17);
  });
  // 베이스 (둥근 저음, 은은하게)
  BASS.forEach(({ step, freq }) => {
    playNote(freq, now + step * STEP, STEP * 3.0, 0.09, "sine");
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
  const notes = [783.99, 1046.5, 1318.51]; // G5 C6 E6 (밝게 올라가는 차임)
  notes.forEach((f, i) => playBell(f, now + i * 0.08, 0.2));
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
