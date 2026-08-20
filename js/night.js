// 🌙 밤 모드: 정해진 시간이 되면 시작 화면이 밤 버전으로 바뀐다.
// - 밤(밤 9시 ~ 새벽 6시)에는 조용한 놀이(잠자리 동화)만 남기고 나머지는 감춘다.
// - 부모가 손으로 잠깐 바꿀 수도 있다(수동 스위치). 손으로 바꾼 설정은
//   "다음으로 낮↔밤이 바뀌는 시각"이 되면 저절로 풀리고 다시 시계를 따른다.
// - 시각은 이 기기(노트북)의 시계를 그대로 쓴다. 인터넷은 필요 없다.

export const NIGHT_START = 21; // 밤 9시부터
export const NIGHT_END = 6; // 새벽 6시까지
export const NIGHT_GAMES = ["story"]; // 밤에 남겨 둘 놀이

const KEY = "ginjoo:nightOverride"; // 손으로 바꾼 설정을 기억해 두는 곳

// 시계만 봤을 때 지금이 밤인지. 자정을 넘어가므로 "9시 이상 또는 6시 미만"으로 본다.
function isNightByClock(now) {
  const h = now.getHours();
  return h >= NIGHT_START || h < NIGHT_END;
}

// 다음으로 낮↔밤이 바뀌는 시각 (밤 9시 / 새벽 6시 중 더 가까운 쪽)
export function nextSwitchTime(now = new Date()) {
  const at = (hour) => {
    const t = new Date(now);
    t.setHours(hour, 0, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1); // 이미 지났으면 내일 그 시각
    return t;
  };
  const a = at(NIGHT_START);
  const b = at(NIGHT_END);
  return a < b ? a : b;
}

function readOverride() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (typeof o.night !== "boolean" || typeof o.until !== "number") return null;
    return o;
  } catch (_) {
    return null; // 저장소를 못 읽는 경우(사생활 보호 모드 등)엔 그냥 시계를 따른다
  }
}

// 지금 밤 모드인지. 손으로 바꾼 설정이 아직 살아 있으면 그게 우선이다.
export function isNightMode(now = new Date()) {
  const o = readOverride();
  if (o && now.getTime() < o.until) return o.night;
  if (o) clearOverride(); // 시각이 지난 설정은 지운다
  return isNightByClock(now);
}

// 손으로 바꾸기. 다음 전환 시각까지만 유지되며, 언제까지인지를 돌려준다.
export function setNightMode(night, now = new Date()) {
  const until = nextSwitchTime(now);
  try {
    localStorage.setItem(KEY, JSON.stringify({ night, until: until.getTime() }));
  } catch (_) {} // 저장이 막혀 있어도 화면은 바뀌게 그냥 넘어간다
  return until;
}

export function clearOverride() {
  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
}

// "밤 9시", "아침 6시"처럼 읽기 쉽게
export function timeLabel(d) {
  const h = d.getHours();
  const when = h < 6 ? "새벽" : h < 12 ? "아침" : h < 18 ? "낮" : "밤";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return when + " " + h12 + "시";
}
