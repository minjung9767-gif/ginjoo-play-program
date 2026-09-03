// 💬 낱말놀이 단어 목록 (동물 카드 — 얼굴만 나오면 헷갈려서 '몸 전체(옆모습)' 이모지로 통일)
// - word : 화면에 보여줄 낱말(한글). 정답을 알려줄 때 글자로도 보여준다.
// - art  : 사진을 못 불러왔을 때 대신 보여줄 이모지 그림 (몸 전체가 보이는 것으로)
// - img  : 카드에 크게 보여줄 실사 사진. 파일이 없거나 못 불러오면 자동으로 art(이모지)로 대체된다.
// - audio: 엄마가 녹음한 음성 파일 경로. 파일이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
//          (잠자리 동화와 똑같은 방식 — 녹음 파일을 assets/words/ 에 넣고 경로만 적어두면 된다)
//
// ※ 참고: 곰·사자·판다·여우·개구리는 이모지에 '몸 전체'가 없어(얼굴만 있음) 목록에서 빼고,
//   몸 전체가 있는 말·소·얼룩말·사슴·다람쥐로 대체했다.

export const WORDS = [
  { word: "강아지", art: "🐕",  audio: "assets/words/gangaji.m4a", img: "assets/words/img/gangaji.png" },
  { word: "고양이", art: "🐈",  audio: "assets/words/goyangi.m4a", img: "assets/words/img/goyangi.png" },
  { word: "토끼",   art: "🐇",  audio: "assets/words/tokki.m4a", img: "assets/words/img/tokki.png" },
  { word: "호랑이", art: "🐅",  audio: "assets/words/horangi.m4a", img: "assets/words/img/horangi.png" },
  { word: "돼지",   art: "🐖",  audio: "assets/words/dwaeji.m4a", img: "assets/words/img/dwaeji.png" },
  { word: "원숭이", art: "🐒",  audio: "assets/words/wonsungi.m4a", img: "assets/words/img/wonsungi.png" },
  { word: "코끼리", art: "🐘",  audio: "assets/words/kokkiri.m4a", img: "assets/words/img/kokkiri.png" },
  { word: "기린",   art: "🦒",  audio: "assets/words/girin.m4a", img: "assets/words/img/girin.png" },
  { word: "말",     art: "🐎",  audio: "assets/words/mal.m4a", img: "assets/words/img/mal.png" },
  { word: "소",     art: "🐄",  audio: "assets/words/so.m4a", img: "assets/words/img/so.png" },
  { word: "얼룩말", art: "🦓",  audio: "assets/words/eollukmal.m4a", img: "assets/words/img/eollukmal.png" },
  { word: "사슴",   art: "🦌",  audio: "assets/words/saseum.m4a", img: "assets/words/img/saseum.png" },
  { word: "다람쥐", art: "🐿️", audio: "assets/words/daramjwi.m4a", img: "assets/words/img/daramjwi.png" },
  { word: "펭귄",   art: "🐧",  audio: "assets/words/penguin.m4a", img: "assets/words/img/penguin.png" },
  { word: "오리",   art: "🦆",  audio: "assets/words/ori.m4a", img: "assets/words/img/ori.png" },
  { word: "병아리", art: "🐤",  audio: "assets/words/byeongari.m4a", img: "assets/words/img/byeongari.png" },
  { word: "거북이", art: "🐢",  audio: "assets/words/geobugi.m4a", img: "assets/words/img/geobugi.png" },
  { word: "물고기", art: "🐟",  audio: "assets/words/mulgogi.m4a", img: "assets/words/img/mulgogi.png" },
  { word: "나비",   art: "🦋",  audio: "assets/words/nabi.m4a", img: "assets/words/img/nabi.png" },
  { word: "공룡",   art: "🦕",  audio: "assets/words/gongryong.m4a", img: "assets/words/img/gongryong.png" },
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
