export type SurveyItem = {
  id: string;
  section: string;
  construct: string;
  text: string;
  reverse?: boolean;
  role: "manipulation" | "primary" | "secondary" | "exploratory";
};

export const USER_STUDY_VERSION = "USQ-V1";
export const VIDEO_SAMPLE_VERSION = "V1";
export const FRAMEWORK_VERSION = "V1";

export const surveyItems: readonly SurveyItem[] = [
  { id: "q01", section: "A", construct: "수행–AI 청중 반응 연동성", role: "manipulation", text: "이 조건에서 AI 청중의 반응은 나의 발표 내용과 전달 수행에 따라 달라졌다고 느꼈다." },
  { id: "q02", section: "A", construct: "수행–AI 청중 반응 연동성", role: "manipulation", text: "내가 발표하는 방식이 달라질 때 AI 청중의 반응도 그에 맞게 달라졌다고 느꼈다." },
  { id: "q03", section: "A", construct: "수행–AI 청중 반응 연동성", role: "manipulation", text: "AI 청중의 반응은 당시 나의 발표 수행 상태를 반영한다고 느꼈다." },
  { id: "q04", section: "B", construct: "지각된 반응성", role: "primary", text: "나의 발표 방식이 AI 청중의 반응에 영향을 주었다고 느꼈다." },
  { id: "q05", section: "B", construct: "지각된 반응성", role: "primary", text: "AI 청중은 나의 구체적인 발표 행동에 반응했다고 느꼈다." },
  { id: "q06", section: "B", construct: "지각된 반응성", role: "primary", text: "나의 목소리나 발표 태도의 변화가 AI 청중의 반응에 영향을 주었다고 느꼈다." },
  { id: "q07", section: "B", construct: "지각된 반응성", role: "primary", text: "나는 AI 청중의 반응이 무엇을 의미하는지 이해할 수 있었다." },
  { id: "q08", section: "C", construct: "상호작용 가능성", role: "secondary", text: "나는 AI 청중과 상호작용하고 있다고 느꼈다." },
  { id: "q09", section: "C", construct: "상호작용 가능성", role: "secondary", text: "나는 AI 청중과 연결되어 있다고 느꼈다." },
  { id: "q10", section: "C", construct: "상호작용 가능성", role: "secondary", text: "나는 VR 공간에서 AI 청중과 반응을 주고받을 수 있다고 느꼈다." },
  { id: "q11", section: "C", construct: "상호작용 가능성", role: "secondary", text: "AI 청중이 VR 공간에서 나를 알아차리고 있다고 느꼈다." },
  { id: "q12", section: "D", construct: "공동현존감", role: "secondary", text: "VR 발표 환경에서 AI 청중이 나와 함께 있다는 것을 의식했다." },
  { id: "q13", section: "D", construct: "공동현존감", role: "secondary", text: "VR 발표 환경에서 나와 같은 공간에 다른 존재가 있다고 느꼈다." },
  { id: "q14", section: "D", construct: "공동현존감", role: "secondary", reverse: true, text: "VR 발표 환경에서 나는 혼자라고 느꼈다." },
  { id: "q15", section: "E", construct: "관찰·평가 지각", role: "secondary", text: "AI 청중이 나의 발표를 지켜보고 있다고 느꼈다." },
  { id: "q16", section: "E", construct: "관찰·평가 지각", role: "secondary", text: "AI 청중이 나의 발표 수행을 평가하고 있다고 느꼈다." },
  { id: "q17", section: "E", construct: "관찰·평가 지각", role: "secondary", text: "AI 청중의 반응 때문에 내가 평가받고 있다는 점을 의식했다." },
  { id: "q18", section: "F", construct: "경험 품질", role: "exploratory", text: "AI 청중의 반응은 자연스럽게 느껴졌다." },
  { id: "q19", section: "F", construct: "경험 품질", role: "exploratory", text: "AI 청중의 반응은 당시 발표 상황에 적절했다." },
  { id: "q20", section: "F", construct: "경험 품질", role: "exploratory", text: "AI 청중의 반응은 적절한 시점에 제시되었다." },
  { id: "q21", section: "F", construct: "경험 품질", role: "exploratory", text: "이 조건에서 발표하는 동안 심리적 부담을 느꼈다." },
  { id: "q22", section: "F", construct: "경험 품질", role: "exploratory", text: "이 조건에서 VR 발표 환경에 몰입했다고 느꼈다." },
] as const;

export const constructDefinitions = [
  { key: "linkage", label: "수행–반응 연동성", ids: ["q01", "q02", "q03"], role: "조작 점검" },
  { key: "responsiveness", label: "지각된 반응성", ids: ["q04", "q05", "q06", "q07"], role: "주요 결과" },
  { key: "interaction", label: "상호작용 가능성", ids: ["q08", "q09", "q10", "q11"], role: "보조 결과" },
  { key: "copresence", label: "공동현존감", ids: ["q12", "q13", "q14"], role: "보조 결과", reverse: ["q14"] },
  { key: "evaluation", label: "관찰·평가 지각", ids: ["q15", "q16", "q17"], role: "보조 결과" },
] as const;

export type StudyProfile = {
  participantId: string;
  conditionOrder: "AB" | "BA";
  subtopics: readonly [string, string];
  conditions: readonly ["contingent" | "noncontingent", "contingent" | "noncontingent"];
};

export const STUDY_TOKEN_HASHES: Readonly<Record<string, StudyProfile>> = {
  "UWk18vlUveOsAsx5F0G-lk0WBqVxsNkmk4u6QEBKSFk": {
    participantId: "USR-TEST-01",
    conditionOrder: "AB",
    subtopics: ["SUBTOPIC-A", "SUBTOPIC-B"],
    conditions: ["contingent", "noncontingent"],
  },
};

export const initialInterviewCodes = [
  "수행–반응 인과 귀속", "반응 의미 판독 가능성", "지각된 에이전시·반응성", "상호작용 가능성",
  "공동현존감", "관찰·평가 지각", "정서적 부담·각성", "몰입·집중", "발표 행동 조절",
  "반응 불일치·신뢰 붕괴", "현실성", "훈련 유용성", "반응 시점·빈도·강도", "개인화 요구",
] as const;

export const interviewQuestions = [
  "두 조건의 발표 경험을 전반적으로 떠올렸을 때 어떤 점이 가장 먼저 기억나나요?",
  "첫 번째 조건에서 기억에 남는 AI 청중 반응은 무엇이었나요?",
  "두 번째 조건에서 기억에 남는 AI 청중 반응은 무엇이었나요?",
  "AI 청중의 반응이 본인의 발표 수행과 관련되어 있다고 느꼈나요? 그렇게 생각한 이유는 무엇인가요?",
  "AI 청중의 반응을 어떤 의미로 해석했나요? 그렇게 해석하게 한 단서는 무엇이었나요?",
  "AI 청중이 단순히 정해진 애니메이션을 반복한 것이 아니라 본인에게 반응한다고 느꼈나요?",
  "AI 청중과 같은 공간에 함께 있다고 느꼈나요?",
  "AI 청중에게 관찰되거나 평가받는다고 느꼈나요? 그 느낌은 발표에 어떤 영향을 주었나요?",
  "AI 청중의 반응을 보고 발표 방식이나 행동을 조절한 적이 있나요?",
  "어떤 조건이 더 현실적이거나 발표 훈련에 유용하다고 느껴졌나요?",
  "AI 청중의 반응을 신뢰하게 하거나 신뢰하지 못하게 한 요소는 무엇인가요?",
  "유지하거나 수정하거나 제거해야 한다고 생각한 반응이 있나요?",
  "한 조건은 발표 수행과 연동되었고 다른 조건은 연동되지 않았다는 설명을 들은 뒤 경험을 다르게 해석하게 되었나요?",
  "그 밖에 AI 청중 반응과 관련해 추가로 말씀하고 싶은 점이 있나요?",
] as const;
