// 💬 낱말놀이 단어 목록 (조금 어려운 새 낱말 — 어휘 늘리기용)
// - word : 화면에 보여줄 낱말(한글). 정답을 알려줄 때 글자로도 보여준다.
// - art  : 크게 보여줄 이모지 그림
// - audio: 엄마가 녹음한 음성 파일 경로. 파일이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
//          (잠자리 동화와 똑같은 방식 — 녹음 파일을 assets/words/ 에 넣고 경로만 적어두면 된다)
//
// 👉 낱말을 바꾸고 싶으면 아래 목록에서 자유롭게 빼거나 더하면 된다(그림 이모지 + 파일명만 맞춰서).
//    녹음을 추가하려면: assets/words/ 에 아래 audio 경로대로 파일을 넣으면 자동으로 엄마 목소리로 바뀐다.

export const WORDS = [
  // 특별한 동물
  { word: "공룡",   art: "🦕", audio: "assets/words/gongryong.m4a" },
  { word: "펭귄",   art: "🐧", audio: "assets/words/penguin.m4a" },
  { word: "문어",   art: "🐙", audio: "assets/words/muneo.m4a" },
  { word: "나비",   art: "🦋", audio: "assets/words/nabi.m4a" },
  { word: "거북이", art: "🐢", audio: "assets/words/geobugi.m4a" },
  { word: "부엉이", art: "🦉", audio: "assets/words/bueongi.m4a" },
  // 채소·과일 (조금 어려운)
  { word: "수박",     art: "🍉", audio: "assets/words/subak.m4a" },
  { word: "옥수수",   art: "🌽", audio: "assets/words/oksusu.m4a" },
  { word: "당근",     art: "🥕", audio: "assets/words/danggeun.m4a" },
  { word: "버섯",     art: "🍄", audio: "assets/words/beoseot.m4a" },
  { word: "가지",     art: "🍆", audio: "assets/words/gaji.m4a" },
  { word: "브로콜리", art: "🥦", audio: "assets/words/beurokolli.m4a" },
  // 탈것
  { word: "소방차",   art: "🚒", audio: "assets/words/sobangcha.m4a" },
  { word: "기차",     art: "🚂", audio: "assets/words/gicha.m4a" },
  { word: "로켓",     art: "🚀", audio: "assets/words/roket.m4a" },
  { word: "자전거",   art: "🚲", audio: "assets/words/jajeongeo.m4a" },
  { word: "헬리콥터", art: "🚁", audio: "assets/words/hellikopteo.m4a" },
  // 자연·사물
  { word: "무지개",   art: "🌈", audio: "assets/words/mujigae.m4a" },
  { word: "눈사람",   art: "⛄", audio: "assets/words/nunsaram.m4a" },
  { word: "선물",     art: "🎁", audio: "assets/words/seonmul.m4a" },
];

// 공용 문구(모든 단어에 함께 쓰이는 말). audio가 없으면 자동 음성으로 대체된다.
// 엄마 목소리로 바꾸고 싶으면 assets/words/ 에 아래 경로대로 파일을 넣으면 된다.
export const PHRASES = {
  // 질문의 뒷부분: "○○ 어디 있어?" 의 "어디 있어?"
  ask:   { audio: "assets/words/_ask.m4a",   text: "어디 있어?" },
  // 틀렸을 때 부드러운 안내
  retry: { audio: "assets/words/_retry.m4a", text: "어? 다시 찾아볼까?" },
  // 칭찬 (여러 개 중 번갈아 재생)
  praise: [
    { audio: "assets/words/_good1.m4a", text: "딩동! 잘했어요" },
    { audio: "assets/words/_good2.m4a", text: "우와, 잘 찾았어요" },
  ],
};
