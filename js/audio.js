// Web Audio API로 배경 멜로디 + 효과음 합성 (외부 음원 파일 불필요)
let ctx = null;
let masterGain = null;
let melodyTimer = null;
let muted = false;
let audioUnlocked = false;

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
  // iOS(16.4+): 합성음을 '재생(playback)' 채널로 보내 무음 스위치 영향을 안 받게
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (_) {}
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  // iOS 오디오 잠금 해제: 제스처 시점에 아주 짧은 무음을 한 번 흘려보냄
  if (!audioUnlocked) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(masterGain);
      src.start(0);
      audioUnlocked = true;
    } catch (_) {}
  }
}

// iOS는 잠시 가만 있으면 오디오를 다시 잠재움 → 소리 내기 직전에 깨운다
function wake() {
  if (ctx && ctx.state === "suspended") ctx.resume();
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

// ===== 통화 배경음악 : mp3 파일 (영상통화 대기중 화면에서만 사용) =====
let callAudio = null;

function ensureCall() {
  if (!callAudio) {
    callAudio = new Audio("assets/call-music.mp3");
    callAudio.loop = true;
    callAudio.volume = 0.8;
  }
  return callAudio;
}

// 통화 음악(대기/연결음) 재생/정지
export function playCallMusic() {
  ensureCall();
  callAudio.muted = muted;
  callAudio.currentTime = 0;
  callAudio.play().catch(() => {});
}
export function stopCallMusic() {
  if (callAudio) callAudio.pause();
}

// 화면 터치 시 효과음 (반짝 올라가는 소리)
export function playSparkle() {
  if (!ctx || muted) return;
  wake();
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // 도 미 솔 (부드럽게 올라가는 차임)
  notes.forEach((f, i) => playBell(f, now + i * 0.08, 0.2));
}

// 비눗방울 터질 때 "퐁" 소리 (짧고 통통)
export function playPop() {
  if (!ctx || muted) return;
  wake();
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
  wake();
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // 도 미 솔 도↑
  notes.forEach((f, i) => playBell(f, now + i * 0.09, 0.22));
}

// 키패드 버튼 누름 소리 (숫자마다 다른 음, 경쾌한 삑)
const KEY_TONES = [330, 392, 440, 494, 523, 587, 659, 698, 784, 880];
export function playKeyBeep(n) {
  if (!ctx || muted) return;
  wake();
  const f = KEY_TONES[((n % 10) + 10) % 10];
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = f;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.26, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.2);
}

// 진짜 현관 초인종처럼 "딩~동~" (맑고 길게, 크게)
function doorbellTone(freq, start, dur) {
  const partials = [
    { m: 1, g: 1.0 },
    { m: 2, g: 0.5 },
    { m: 3, g: 0.22 },
    { m: 5.4, g: 0.08 },
  ];
  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * p.m;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.5 * p.g, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  });
}
export function playDing() {
  if (!ctx || muted) return;
  wake();
  const now = ctx.currentTime;
  doorbellTone(659.25, now, 0.9);        // 딩 (E5)
  doorbellTone(523.25, now + 0.5, 1.4);  // 동~ (C5, 더 길게)
}

// 문 열림 "띠리링~" (밝게 올라가는 차임)
export function playDoorOpen() {
  if (!ctx || muted) return;
  wake();
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((f, i) => playBell(f, now + i * 0.11, 0.24));
}

export function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.6; // 효과음
  if (callAudio) callAudio.muted = muted; // 통화 음악
  return muted;
}

export function isMuted() {
  return muted;
}
