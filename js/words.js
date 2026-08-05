// 💬 낱말놀이 단어 목록
// - word : 화면에 보여줄 낱말(한글). 정답을 알려줄 때 글자로도 잠깐 보여준다.
// - art  : 크게 보여줄 이모지 그림
// - audio: 엄마가 녹음한 음성 파일 경로. 파일이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
//          (잠자리 동화와 똑같은 방식 — 녹음 파일을 assets/words/ 에 넣고 경로만 적어두면 된다)
//
// 👉 녹음을 추가하려면: assets/words/ 에 아래 audio 경로대로 파일을 넣기만 하면 된다.
//    (형식은 m4a·mp3 등 무엇이든 OK. 파일이 없으면 자동 음성으로 자동 대체된다.)

export const WORDS = [
  // ① 말문 트기 쉬운 "한 글자"
  { word: "공",   art: "⚽", audio: "assets/words/gong.m4a" },
  { word: "밥",   art: "🍚", audio: "assets/words/bap.m4a" },
  { word: "빵",   art: "🍞", audio: "assets/words/ppang.m4a" },
  { word: "물",   art: "💧", audio: "assets/words/mul.m4a" },
  { word: "문",   art: "🚪", audio: "assets/words/mun.m4a" },
  { word: "불",   art: "💡", audio: "assets/words/bul.m4a" },
  { word: "컵",   art: "🥤", audio: "assets/words/keop.m4a" },
  { word: "책",   art: "📖", audio: "assets/words/chaek.m4a" },
  // ② 매일 쓰는 "두 글자" 물건
  { word: "우유", art: "🥛", audio: "assets/words/uyu.m4a" },
  { word: "신발", art: "👟", audio: "assets/words/sinbal.m4a" },
  { word: "양말", art: "🧦", audio: "assets/words/yangmal.m4a" },
  { word: "모자", art: "🧢", audio: "assets/words/moja.m4a" },
  { word: "가방", art: "🎒", audio: "assets/words/gabang.m4a" },
  { word: "우산", art: "☂️", audio: "assets/words/usan.m4a" },
  { word: "칫솔", art: "🪥", audio: "assets/words/chissol.m4a" },
  { word: "비누", art: "🧼", audio: "assets/words/binu.m4a" },
  { word: "시계", art: "⏰", audio: "assets/words/sigye.m4a" },
  { word: "전화", art: "📱", audio: "assets/words/jeonhwa.m4a" },
  { word: "과자", art: "🍪", audio: "assets/words/gwaja.m4a" },
  { word: "풍선", art: "🎈", audio: "assets/words/pungseon.m4a" },
];

// 공용 문구(모든 단어에 함께 쓰이는 말). audio가 없으면 자동 음성으로 대체된다.
// 엄마 목소리로 바꾸고 싶으면 assets/words/ 에 아래 경로대로 파일을 넣으면 된다.
export const PHRASES = {
  // 질문의 뒷부분: "○○ 어디 있어?" 의 "어디 있어?"
  ask:   { audio: "assets/words/_ask.m4a",   text: "어디 있어?" },
  // 정답 맞힌 뒤 따라 말하도록 유도: "이게 뭐야?"
  what:  { audio: "assets/words/_what.m4a",  text: "이게 뭐야?" },
  // 틀렸을 때 부드러운 안내
  retry: { audio: "assets/words/_retry.m4a", text: "어? 다시 찾아볼까?" },
  // 칭찬 (여러 개 중 번갈아 재생)
  praise: [
    { audio: "assets/words/_good1.m4a", text: "딩동! 잘했어요" },
    { audio: "assets/words/_good2.m4a", text: "우와, 잘 찾았어요" },
  ],
};
