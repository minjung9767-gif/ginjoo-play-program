// 🔢 숫자 놀이(동물 친구 밥 주기) 데이터
// - 동물 사진은 낱말놀이 사진(assets/words/img/)을 그대로 쓴다.
// - audio: 엄마가 녹음한 음성 파일 경로. 파일이 있으면 그 목소리로, 없으면 자동 음성(TTS)으로 대체된다.
//          (낱말놀이와 똑같은 방식 — assets/numbers/ 에 아래 이름대로 파일을 넣기만 하면 된다)

// 한 번에 달라고 하는 먹이 개수 (1~3). 잘하게 되면 MAX_COUNT만 늘리면 된다(최대 5).
export const MAX_COUNT = 3;
// 한 판에 밥을 주는 동물 수 (다 먹이면 다 같이 춤추며 마무리)
export const ANIMALS_PER_ROUND = 5;

export const ANIMALS = [
  {
    name: "강아지", art: "🐕", img: "assets/words/img/gangaji.png",
    cry:  { audio: "assets/numbers/cry-gangaji.m4a", text: "멍멍!" },
    food: { art: "🦴", audio: "assets/numbers/food-ppyeo.m4a", text: "뼈다귀" },
  },
  {
    name: "고양이", art: "🐈", img: "assets/words/img/goyangi.png",
    cry:  { audio: "assets/numbers/cry-goyangi.m4a", text: "야옹!" },
    food: { art: "🐟", audio: "assets/numbers/food-saengseon.m4a", text: "생선" },
  },
  {
    name: "토끼", art: "🐇", img: "assets/words/img/tokki.png",
    cry:  { audio: "assets/numbers/cry-tokki.m4a", text: "깡충깡충!" },
    food: { art: "🥕", audio: "assets/numbers/food-danggeun.m4a", text: "당근" },
  },
  {
    name: "원숭이", art: "🐒", img: "assets/words/img/wonsungi.png",
    cry:  { audio: "assets/numbers/cry-wonsungi.m4a", text: "우끼끼!" },
    food: { art: "🍌", audio: "assets/numbers/food-banana.m4a", text: "바나나" },
  },
  {
    name: "다람쥐", art: "🐿️", img: "assets/words/img/daramjwi.png",
    cry:  { audio: "assets/numbers/cry-daramjwi.m4a", text: "쪼르르!" },
    food: { art: "🌰", audio: "assets/numbers/food-dotori.m4a", text: "도토리" },
  },
];

// 먹이를 하나 줄 때마다 세어 주는 말 (하나, 둘, 셋 …)
export const COUNT_WORDS = [
  { audio: "assets/numbers/1.m4a", text: "하나!" },
  { audio: "assets/numbers/2.m4a", text: "둘!" },
  { audio: "assets/numbers/3.m4a", text: "셋!" },
  { audio: "assets/numbers/4.m4a", text: "넷!" },
  { audio: "assets/numbers/5.m4a", text: "다섯!" },
  { audio: "assets/numbers/6.m4a", text: "여섯!" },
];

// "○개 주세요~" (먹이 이름 뒤에 붙는다: "뼈다귀" + "두 개 주세요~")
export const ASK_WORDS = [
  { audio: "assets/numbers/ask-1.m4a", text: "한 개 주세요~", label: "한 개" },
  { audio: "assets/numbers/ask-2.m4a", text: "두 개 주세요~", label: "두 개" },
  { audio: "assets/numbers/ask-3.m4a", text: "세 개 주세요~", label: "세 개" },
  { audio: "assets/numbers/ask-4.m4a", text: "네 개 주세요~", label: "네 개" },
  { audio: "assets/numbers/ask-5.m4a", text: "다섯 개 주세요~", label: "다섯 개" },
];

// 공용 문구
export const NUM_PHRASES = {
  thanks: { audio: "assets/numbers/_thanks.m4a", text: "냠냠, 고마워!" },  // 딱 맞게 다 줬을 때
  more:   { audio: "assets/numbers/_more.m4a",   text: "하나 더 줄래?" },   // 덜 주고 가만히 있을 때
  lots:   { audio: "assets/numbers/_lots.m4a",   text: "우와, 많이 먹었다!" }, // 더 줬을 때
  finish: { audio: "assets/numbers/_finish.m4a", text: "다 먹었다! 긴주 최고!" }, // 한 판 끝
};
