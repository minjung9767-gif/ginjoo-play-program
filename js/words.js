// 💬 낱말놀이 단어 목록 (동물 카드)
// - word : 화면에 보여줄 낱말(한글). 정답을 알려줄 때 글자로도 보여준다.
// - art  : 크게 보여줄 이모지 그림
// - audio: 엄마가 녹음한 음성 파일 경로. 파일이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
//          (잠자리 동화와 똑같은 방식 — 녹음 파일을 assets/words/ 에 넣고 경로만 적어두면 된다)
//
// 👉 낱말을 바꾸고 싶으면 아래 목록에서 자유롭게 빼거나 더하면 된다(그림 이모지 + 파일명만 맞춰서).
//    녹음을 추가하려면: assets/words/ 에 아래 audio 경로대로 파일을 넣으면 자동으로 엄마 목소리로 바뀐다.

export const WORDS = [
  { word: "강아지", art: "🐶", audio: "assets/words/gangaji.m4a" },
  { word: "고양이", art: "🐱", audio: "assets/words/goyangi.m4a" },
  { word: "토끼",   art: "🐰", audio: "assets/words/tokki.m4a" },
  { word: "곰",     art: "🐻", audio: "assets/words/gom.m4a" },
  { word: "사자",   art: "🦁", audio: "assets/words/saja.m4a" },
  { word: "호랑이", art: "🐯", audio: "assets/words/horangi.m4a" },
  { word: "코끼리", art: "🐘", audio: "assets/words/kokkiri.m4a" },
  { word: "기린",   art: "🦒", audio: "assets/words/girin.m4a" },
  { word: "원숭이", art: "🐵", audio: "assets/words/wonsungi.m4a" },
  { word: "판다",   art: "🐼", audio: "assets/words/panda.m4a" },
  { word: "돼지",   art: "🐷", audio: "assets/words/dwaeji.m4a" },
  { word: "오리",   art: "🦆", audio: "assets/words/ori.m4a" },
  { word: "병아리", art: "🐤", audio: "assets/words/byeongari.m4a" },
  { word: "개구리", art: "🐸", audio: "assets/words/gaeguri.m4a" },
  { word: "펭귄",   art: "🐧", audio: "assets/words/penguin.m4a" },
  { word: "여우",   art: "🦊", audio: "assets/words/yeou.m4a" },
  { word: "물고기", art: "🐟", audio: "assets/words/mulgogi.m4a" },
  { word: "거북이", art: "🐢", audio: "assets/words/geobugi.m4a" },
  { word: "나비",   art: "🦋", audio: "assets/words/nabi.m4a" },
  { word: "공룡",   art: "🦕", audio: "assets/words/gongryong.m4a" },
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
