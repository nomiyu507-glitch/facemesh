/* config.js — questions, patches, intro constants */

const APP_SERIF = '"Nanum Gothic", Georgia, "Times New Roman", Times, serif';
const APP_DOSIS = '"Dosis", sans-serif';

const QUESTIONS = [
  {
    id: "identity",
    question: "무엇이 당신의 정체성을 형성하나요?",
    options: [
      { key: "Family", label: "가족" },
      { key: "School", label: "학교" },
      { key: "Society", label: "사회" },
      { key: "Appearance", label: "외모" },
      { key: "Myself", label: "나 자신" },
    ],
  },
  {
    id: "perception",
    question: "타인은 당신을 어떻게 바라보나요?",
    options: [
      { key: "Quiet", label: "조용한" },
      { key: "Useful", label: "유용한" },
      { key: "Successful", label: "성공한" },
      { key: "Kind", label: "착한" },
      { key: "Difficult", label: "어려운" },
    ],
  },
  {
    id: "mask",
    question: "당신은 어떤 가면을 가장 자주 쓰고 있나요?",
    options: [
      { key: "Perfect", label: "완벽한" },
      { key: "Confident", label: "자신감 있는" },
      { key: "Productive", label: "생산적인" },
      { key: "Easygoing", label: "무던한" },
      { key: "Untouchable", label: "다가가기 어려운" },
    ],
  },
  {
    id: "unseen",
    question: "무엇이 보이지 않은 채로 남아 있나요?",
    options: [
      { key: "Fear", label: "두려움" },
      { key: "Anger", label: "분노" },
      { key: "Tiredness", label: "피로" },
      { key: "Failure", label: "실패" },
      { key: "Desire", label: "욕망" },
    ],
  },
];

function resolveAnswerKey(questionId, raw) {
  if (raw == null || raw === "") return null;
  const q = QUESTIONS.find((item) => item.id === questionId);
  if (!q) return String(raw).trim();
  const trimmed = String(raw).trim();
  for (const opt of q.options) {
    const key = opt.key || opt;
    const label = opt.label || opt;
    if (trimmed === key || trimmed === label) return key;
  }
  const lower = trimmed.toLowerCase();
  for (const opt of q.options) {
    const key = opt.key || opt;
    if (String(key).toLowerCase() === lower) return key;
  }
  return trimmed;
}

function optionLabelForKey(questionId, key) {
  const q = QUESTIONS.find((item) => item.id === questionId);
  const opt = q?.options?.find((item) => (item.key || item) === key);
  return opt?.label || key;
}

const translatedLabelWordsKo = {
  q1: {
    Family: ["착한 아이", "가족 기대", "실망 금지", "걱정 금지", "자랑거리", "책임감"],
    School: ["규칙 준수", "성적 모드", "평가 대상", "기준 충족", "낙오 금지", "더 노력"],
    Society: ["튀지 않기", "정상 범주", "사회 기준", "문제 없음", "역할 수행", "적응 완료"],
    Appearance: ["보기 좋게", "외모 평가", "단정함", "더 웃기", "호감형", "괜찮아 보임"],
    Myself: ["내 목소리", "내 선택", "여전히 나", "라벨 아님", "나의 형태", "되는 중"],
  },
  q2: {
    Quiet: ["조용히", "말 아끼기", "작은 목소리", "눈에 안 띔", "침묵", "보이지 않음"],
    Useful: ["#업무-03", "사용 중", "쓸모 있음", "도움됨", "더 하기", "대기 중"],
    Successful: ["A등급", "기대 이상", "인정됨", "성과형", "아직 부족", "좋은 결과"],
    Kind: ["항상 괜찮음", "호감형", "거절 금지", "배려 우선", "불평 금지", "웃어넘김"],
    Difficult: ["쉽지 않음", "예민함", "다루기 어려움", "비협조적", "수정 필요", "너무 많음"],
  },
  q3: {
    Perfect: ["오류 없음", "흠 없음", "수정 필요", "실수 금지", "통제 유지", "무너지지 않기"],
    Confident: ["강해 보임", "두려움 없음", "흔들림 없음", "당당함", "힘 있음", "용감한 척"],
    Productive: ["다음 할 일", "계속 하기", "남은 시간", "작업 모드", "휴식 금지", "결과 요구"],
    Easygoing: ["문제없음", "계속 웃기", "맞춰주기", "무던함", "괜찮은 척", "쉽게 넘김"],
    Untouchable: ["거리 유지", "접근 금지", "단단한 껍질", "닫힘", "차가운 겉", "방어 중"],
  },
  q4: {
    Fear: ["숨기기", "감추기", "작아지기", "안전 우선", "물러서기", "속의 두려움"],
    Anger: ["참기", "삼키기", "진정하기", "반응 금지", "속에 넣기", "속의 불"],
    Tiredness: ["배터리 부족", "계속 일함", "휴식 없음", "비어감", "계속 움직임", "조용한 피로"],
    Failure: ["다시 시도", "아직 부족", "더 잘하기", "개선 필요", "더 노력", "틀린 답"],
    Desire: ["더 원함", "말 못함", "숨은 바람", "묻지 않기", "비밀", "개인적 꿈"],
  },
  system: ["라벨됨", "일치 87%", "조각 ID", "프로필 생성", "역할 지정", "라벨 적용"],
};

const CHOICE_LABEL_MAP = Object.fromEntries(
  Object.entries(translatedLabelWordsKo.q1).map(([key, words]) => [key, words.slice(0, 3)])
);
for (const [key, words] of Object.entries(translatedLabelWordsKo.q2)) {
  CHOICE_LABEL_MAP[key] = words.slice(0, 3);
}
for (const [key, words] of Object.entries(translatedLabelWordsKo.q3)) {
  CHOICE_LABEL_MAP[key] = words.slice(0, 3);
}
for (const [key, words] of Object.entries(translatedLabelWordsKo.q4)) {
  CHOICE_LABEL_MAP[key] = words.slice(0, 3);
}

const PATCH_LAYOUTS = [
  {
    id: "foreheadPatch",
    rx: 0.16,
    ry: 0.02,
    rw: 0.68,
    rh: 0.22,
    textAnchorX: 0.5,
    textAnchorY: 0.5,
    drawLayer: 2,
  },
  {
    id: "leftFacePatch",
    rx: 0.04,
    ry: 0.25,
    rw: 0.42,
    rh: 0.34,
    textAnchorX: 0.45,
    textAnchorY: 0.5,
    drawLayer: 3,
  },
  {
    id: "rightFacePatch",
    rx: 0.54,
    ry: 0.25,
    rw: 0.42,
    rh: 0.34,
    textAnchorX: 0.55,
    textAnchorY: 0.5,
    drawLayer: 3,
  },
  {
    id: "centerNosePatch",
    rx: 0.36,
    ry: 0.28,
    rw: 0.28,
    rh: 0.42,
    textAnchorX: 0.5,
    textAnchorY: 0.48,
    drawLayer: 0,
    fillAlphaMul: 0.78,
  },
  {
    id: "lowerFacePatch",
    rx: 0.18,
    ry: 0.62,
    rw: 0.64,
    rh: 0.26,
    textAnchorX: 0.5,
    textAnchorY: 0.52,
    drawLayer: 1,
  },
];

const PATCH_COLORS = [
  { fill: [38, 48, 62], edge: [255, 255, 255] },
  { fill: [52, 40, 62], edge: [255, 255, 255] },
  { fill: [34, 56, 58], edge: [255, 255, 255] },
  { fill: [56, 60, 44], edge: [255, 255, 255] },
  { fill: [62, 50, 42], edge: [255, 255, 255] },
];

const ORB_HOVER_MS = 1000;
const ORB_DISSOLVE_MS = 760;
const ORB_HIT_PAD = 18;
const ORB_FLOAT_AMP_X = 3.2;
const ORB_FLOAT_AMP_Y = 2.6;
const ORB_DRIFT_AMP = 8;
const ORB_DRIFT_SPEED = 0.18;
const ORB_FLOAT_SPEED = 0.48;
const ORB_ORBIT_X = 0.31;
const ORB_ORBIT_Y = 0.3;
const ORB_SIDE_SPREAD = 0.32;
const ORB_BREATH_SPEED = 0.0014;
const ORB_BREATH_AMP = 0.028;
const QUESTION_HAND_LERP = 0.26;
const QUESTION_PAGE_EXIT_MS = 480;
const QUESTION_PAGE_ENTER_MS = 720;

const PATCH_READY_FRAMES = 42;
const PATCH_TEAR_FRAMES = 70;
const PATCH_HIT_PAD = 32;
const PATCH_HIT_PAD_CENTER = 48;
const FINGER_HIT_RADIUS = 42;
const FINGER_HIT_RADIUS_CENTER = 52;
const PATCH_TEAR_ANIM_MS = 520;
const CONTINUE_DELAY_MS = 8000;
const PATCH_KEPT_ALPHA_MIN = 145;
const PATCH_KEPT_ALPHA_MAX = 185;
const PATCH_BASE_ALPHA = 168;

const INTRO_WEBCAM_MS = 33;
const INTRO_MESH_MS = 80;
const INTRO_FACE_BUFFER_MAX = 200;
const INTRO_MESH_LINE = "rgba(111, 111, 111, 0.42)";
const INTRO_MESH_POINT = "rgba(119, 119, 119, 0.4)";
const INTRO_MESH_LINE_EMPHASIS = "rgba(105, 105, 105, 0.52)";
const INTRO_MESH_POINT_EMPHASIS = "rgba(112, 112, 112, 0.48)";
const INTRO_MESH_DUST = "rgba(118, 118, 118, 1)";
const INTRO_MESH_LINE_WIDTH = 0.72;
const INTRO_MESH_LINE_WIDTH_EMPHASIS = 0.88;
const INTRO_MESH_POINT_RADIUS = 1.15;
const INTRO_MESH_POINT_RADIUS_EMPHASIS = 1.28;
const INTRO_MESH_EMPHASIS_PARTS = new Set(["noseBridge", "noseWings"]);

const COLLAGE_LAYER_DEBUG = false;
const COLLAGE_ANSWER_DEBUG = false;
const COLLAGE_DEBUG_LINE_WIDTH = 1.5;
const COLLAGE_DEBUG_ALPHA = 145;
