"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";

type Score = 1 | 2 | 3 | 4 | null;
type VideoKey = "A" | "B";
type ScoredAnswer = { score: Score; unable: boolean; comment: string; critical: boolean };
type VideoStageAnswer = { timeRange: string; rating: string; comment: string };
type SurveyState = {
  model: Record<string, ScoredAnswer>;
  modelRecommendation: string;
  confidence: Score;
  coreRevision: string;
  missingDuplicate: string;
  videos: Record<VideoKey, Record<string, VideoStageAnswer>>;
  framework: Record<string, ScoredAnswer>;
  legacyResponses: Record<string, unknown>;
};
type ReviewData = {
  schemaVersion: "1.1";
  participantId: string;
  updatedAt: string;
  submissionStatus: "draft" | "submitted";
  submittedAt: string | null;
  expert: {
    expertise: string[]; otherExpertise: string; highestDegree: string; otherDegree: string;
    careerYears: string; affiliationType: string; otherAffiliation: string; conflict: string; conflictDetails: string;
  };
  session: {
    reviewDate: string;
    frameworkVersion: string;
    animationSetVersion: string;
    interviewMode: string;
    preferredLocation: string;
    interviewAvailability: string;
    recording: string;
  };
  ruleEvaluations: unknown[];
  overall: SurveyState;
};

const DEFAULT_FRAMEWORK_VERSION = "V1";

const modelCriteria = [
  { key: "modelStructure", label: "모델 구성 적절성", statement: "E·V·C 세 차원의 결합이 AI 청중의 주의·평가·이해 상태를 설명하는 데 적절하다." },
  { key: "dimensionClarity", label: "차원 구분 명확성", statement: "Engagement, Evaluative Valence, Cognitive Clarity의 정의와 상호 관계가 명확하며 개념적 중복이 과도하지 않다." },
  { key: "modelCoverage", label: "모델 포괄성", statement: "E·V·C 모델이 발표 상황에서 중요하게 고려해야 하는 청중 상태를 충분히 포함한다." },
  { key: "stageStructure", label: "발표 단계 구성 적절성", statement: "본 연구에서 사용한 8개 발표 단계와 단계별 평가 관점의 연결이 발표의 전개와 청중의 평가 과정을 설명하는 데 적절하다." },
  { key: "inputConnection", label: "입력 연결 적절성", statement: "발표 단계별 내용 평가 결과와 전달 수행정보가 E·V·C 청중 상태에 반영되는 방식이 이론적·실무적으로 적절하다." },
  { key: "agentCharacteristics", label: "에이전트 특성 반영 적절성", statement: "발표 주제에 대한 관심도와 배경지식이 개별 AI 청중 에이전트의 E·V·C 상태 차이에 적절하게 반영된다." },
  { key: "stateUpdate", label: "상태 갱신 일관성", statement: "현재의 발표 수행정보, 이전 청중 상태 및 개별 에이전트 특성을 반영하여 E·V·C 상태를 갱신하는 구조가 일관되고 납득 가능하다." },
  { key: "backchannelExpression", label: "백채널 표현 적절성", statement: "E·V·C 청중 상태가 표정·자세·시선·고개 움직임의 조합으로 적절하게 표현된다." },
  { key: "meaningInterpretation", label: "의미 해석 적절성", statement: "백채널 표현은 인간의 비언어적 반응에서 나타날 수 있는 자연스러운 모호성이 있더라도 의도한 E·V·C 상태의 범위 안에서 해석될 수 있다." },
  { key: "meaningScopeRisk", label: "의미 범위 이탈 위험", statement: "백채널 표현이 의도한 E·V·C 상태의 범위를 벗어난 의미로 해석되거나 부당한 평가로 받아들여질 위험은 어느 정도입니까?" },
];

const frameworkItems = [
  { key: "overallConsistency", label: "전체 구조의 일관성", statement: "발표 수행정보 입력, E·V·C 상태 산출·갱신 및 백채널 표현으로 이어지는 전체 구조가 논리적으로 연결되어 있다." },
  { key: "reactionTiming", label: "반응 시점의 적절성", statement: "반응 발생 시점, 지연시간, 지속시간 및 쿨다운 원칙이 실제 발표 상황에서 자연스럽다." },
  { key: "reactionIntensity", label: "반응 강도·빈도의 적절성", statement: "백채널의 강도와 반복 빈도에 관한 원칙이 과도하거나 부족하지 않다." },
  { key: "agentDistribution", label: "에이전트 분배의 적절성", statement: "반응하는 에이전트의 수와 배분 방식이 개별 에이전트의 차이를 반영하면서 자연스러운 청중 집단 반응을 형성한다." },
  { key: "trainingFit", label: "발표 훈련 목적 적합성", statement: "긍정적·중립적·비판적 반응의 구성과 범위가 발표 훈련의 목적에 적절하다." },
  { key: "exceptionHandling", label: "예외 처리의 충분성", statement: "오탐, 불확실성 및 상충하는 수행 신호가 발생했을 때의 반응 생략·유지·전환 원칙이 충분하다." },
  { key: "implementationTraceability", label: "구현 및 추적 가능성", statement: "프레임워크를 실제 VR 발표 훈련 시스템에 일관되게 구현하고, 수행정보·청중 상태·백채널 표현의 연결 과정을 기록하고 확인할 수 있다." },
];

const appraisalDefinitions = [
  { term: "새로움", english: "novelty", description: "해당 구간이 청중의 예상을 벗어나거나 주의를 새롭게 환기하는 정도" },
  { term: "내재적 쾌·불쾌", english: "intrinsic pleasantness", description: "내용과 표현이 청중에게 즉각적으로 긍정적 또는 부정적 인상을 주는 정도" },
  { term: "목표 관련성", english: "goal relevance", description: "내용이 청중의 관심, 기대 또는 발표를 듣는 목적과 관련되는 정도" },
  { term: "대처 가능성", english: "coping potential", description: "제시된 상황을 통제하거나 이에 적응·대응할 수 있다고 판단하는 정도" },
  { term: "규범·자기 일치성", english: "norm/self compatibility", description: "내용과 주장이 청중의 지식, 가치, 사회·학문적 규범 또는 자기 관점과 부합하는 정도" },
];

const presentationStages = [
  { key: "introduction", name: "도입부", requirement: "필수", rationale: "새로움: 주의 환기 · 내재적 쾌·불쾌: 첫인상" },
  { key: "motivation", name: "연구 동기", requirement: "필수", rationale: "목표 관련성: 연구 필요성이 청중의 관심·목적과 연결됨" },
  { key: "theory", name: "이론적 틀", requirement: "선택", rationale: "규범·자기 일치성: 기존 지식·학문적 관점과의 부합" },
  { key: "purpose", name: "연구 목적", requirement: "필수", rationale: "목표 관련성: 목적의 중요성 · 규범·자기 일치성: 가치·규범과의 부합" },
  { key: "method", name: "연구 방법", requirement: "필수", rationale: "대처 가능성: 연구 접근의 실행 가능성·문제 대응 가능성" },
  { key: "results", name: "연구 결과", requirement: "선택", rationale: "새로움: 결과의 예상 밖 정보 · 내재적 쾌·불쾌: 즉각적 인상 · 목표 관련성: 결과의 유용성" },
  { key: "implications", name: "연구 함의", requirement: "필수", rationale: "목표 관련성: 활용·중요성 · 규범·자기 일치성: 가치·규범과의 부합" },
  { key: "closing", name: "마무리", requirement: "필수", rationale: "내재적 쾌·불쾌: 발표 전반에 대한 마무리 인상" },
];
const videoRatings = ["적절함", "부분적으로 적절함", "부적절함", "판단 어려움", "해당 없음"];

function todayInKorea() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}
function newScoredAnswer(): ScoredAnswer { return { score: null, unable: false, comment: "", critical: false }; }
function newVideoStageAnswer(): VideoStageAnswer { return { timeRange: "", rating: "", comment: "" }; }
function initialSurveyState(): SurveyState {
  const emptyVideos = () => Object.fromEntries(presentationStages.map((stage) => [stage.key, newVideoStageAnswer()]));
  return {
    model: Object.fromEntries(modelCriteria.map((item) => [item.key, newScoredAnswer()])),
    modelRecommendation: "", confidence: null, coreRevision: "", missingDuplicate: "",
    videos: { A: emptyVideos(), B: emptyVideos() },
    framework: Object.fromEntries(frameworkItems.map((item) => [item.key, newScoredAnswer()])),
    legacyResponses: {},
  };
}
function normalizeSurveyState(value: unknown): SurveyState {
  const defaults = initialSurveyState();
  const parsed = value && typeof value === "object" ? value as Partial<SurveyState> : {};
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const currentKeys = new Set(["model", "modelRecommendation", "confidence", "coreRevision", "missingDuplicate", "videos", "framework", "legacyResponses"]);
  const legacyEntries = Object.fromEntries(Object.entries(raw).filter(([key]) => !currentKeys.has(key)));
  const mergeScored = (definitions: typeof modelCriteria, source: Record<string, ScoredAnswer> | undefined) => Object.fromEntries(definitions.map((item) => [item.key, { ...newScoredAnswer(), ...(source?.[item.key] ?? {}) }]));
  const mergeVideo = (key: VideoKey) => Object.fromEntries(presentationStages.map((stage) => [stage.key, { ...newVideoStageAnswer(), ...(parsed.videos?.[key]?.[stage.key] ?? {}) }]));
  return {
    ...defaults,
    ...parsed,
    model: mergeScored(modelCriteria, parsed.model),
    videos: { A: mergeVideo("A"), B: mergeVideo("B") },
    framework: mergeScored(frameworkItems, parsed.framework),
    legacyResponses: { ...(parsed.legacyResponses ?? {}), ...legacyEntries },
  };
}
function initialData(participantId: string): ReviewData {
  return {
    schemaVersion: "1.1", participantId, updatedAt: new Date().toISOString(), submissionStatus: "draft", submittedAt: null,
    expert: { expertise: [], otherExpertise: "", highestDegree: "", otherDegree: "", careerYears: "", affiliationType: "", otherAffiliation: "", conflict: "없음", conflictDetails: "" },
    session: {
      reviewDate: todayInKorea(), frameworkVersion: DEFAULT_FRAMEWORK_VERSION, animationSetVersion: "",
      interviewMode: "", preferredLocation: "", interviewAvailability: "", recording: "",
    },
    ruleEvaluations: [], overall: initialSurveyState(),
  };
}
function normalizeReviewData(value: unknown, participantId: string): ReviewData | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<ReviewData>;
  if (parsed.participantId !== participantId) return null;
  const defaults = initialData(participantId);
  const interviewMode = parsed.session?.interviewMode === "비공개 온라인 화상회의" ? "비공개 온라인 화상회의(Zoom)" : (parsed.session?.interviewMode ?? "");
  const recording = parsed.session?.recording === "녹음함(별도 동의 확인)" ? "녹음에 동의함(별도 동의 확인)" : (parsed.session?.recording ?? "");
  return {
    ...defaults, ...parsed, schemaVersion: "1.1", participantId,
    expert: { ...defaults.expert, ...parsed.expert },
    session: {
      reviewDate: parsed.session?.reviewDate || defaults.session.reviewDate,
      frameworkVersion: parsed.session?.frameworkVersion || DEFAULT_FRAMEWORK_VERSION,
      animationSetVersion: parsed.session?.animationSetVersion ?? "",
      interviewMode,
      preferredLocation: parsed.session?.preferredLocation ?? "",
      interviewAvailability: parsed.session?.interviewAvailability ?? "",
      recording,
    },
    ruleEvaluations: Array.isArray(parsed.ruleEvaluations) ? parsed.ruleEvaluations : [],
    overall: normalizeSurveyState(parsed.overall),
    submissionStatus: parsed.submissionStatus === "submitted" ? "submitted" : "draft",
    submittedAt: typeof parsed.submittedAt === "string" ? parsed.submittedAt : null,
  };
}

function ScorePicker({ value, onChange, label, disabled = false }: { value: Score; onChange: (score: Score) => void; label: string; disabled?: boolean }) {
  return <div className="score-picker" role="radiogroup" aria-label={label} aria-disabled={disabled}>
    {[1, 2, 3, 4].map((score) => <button key={score} type="button" role="radio" data-score={score} aria-checked={value === score} className={value === score ? "selected" : ""} disabled={disabled} onClick={() => onChange(score as Score)}>{score}</button>)}
  </div>;
}

export function ExpertReviewForm({ participantId, reviewToken }: { participantId: string; reviewToken: string }) {
  const storageKey = `rehear-review-${participantId}`;
  const [data, setData] = useState<ReviewData>(() => initialData(participantId));
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [syncStatus, setSyncStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [videoAvailable, setVideoAvailable] = useState<Record<VideoKey, boolean | null>>({ A: null, B: null });

  useEffect(() => {
    let active = true;
    async function restoreDraft() {
      let restoredData = initialData(participantId);
      const stored = window.localStorage.getItem(storageKey);
      try { if (stored) { const localData = normalizeReviewData(JSON.parse(stored), participantId); if (localData) restoredData = localData; } } catch { window.localStorage.removeItem(storageKey); }
      try {
        const snapshot = await getDoc(doc(firestore, "expertReviewResponses", reviewToken));
        const serverData = snapshot.exists() ? normalizeReviewData(snapshot.data(), participantId) : null;
        if (serverData && new Date(serverData.updatedAt).getTime() >= new Date(restoredData.updatedAt).getTime()) restoredData = serverData;
        if (active) setSyncStatus(snapshot.exists() ? "saved" : "ready");
      } catch { if (active) setSyncStatus("error"); }
      if (active) { setData(restoredData); setRestored(true); }
    }
    restoreDraft();
    return () => { active = false; };
  }, [participantId, reviewToken, storageKey]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => {
      const next: ReviewData = { ...data, updatedAt: new Date().toISOString() };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setSyncStatus("saving");
      setDoc(doc(firestore, "expertReviewResponses", reviewToken), { ...next, serverUpdatedAt: serverTimestamp() }, { merge: true })
        .then(() => { setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })); setSyncStatus("saved"); })
        .catch(() => setSyncStatus("error"));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [data, restored, reviewToken, storageKey]);

  const syncLabel = syncStatus === "loading" ? "저장된 초안 확인 중" : syncStatus === "saving" ? "자동 저장 중" : syncStatus === "saved" ? `${savedAt || "현재"} 자동 저장됨` : syncStatus === "error" ? "임시 저장됨 · 연결 시 다시 저장" : "자동 저장 준비 완료";
  const completion = useMemo(() => {
    const model = Object.values(data.overall.model).filter((answer) => answer.score || answer.unable).length;
    const videos = Object.values(data.overall.videos).flatMap((sample) => Object.values(sample)).filter((answer) => answer.rating).length;
    const framework = Object.values(data.overall.framework).filter((answer) => answer.score || answer.unable).length;
    return Math.round(((model + videos + framework) / (modelCriteria.length + presentationStages.length * 2 + frameworkItems.length)) * 100);
  }, [data.overall]);

  function updateExpert<K extends keyof ReviewData["expert"]>(key: K, value: ReviewData["expert"][K]) { setData((current) => ({ ...current, expert: { ...current.expert, [key]: value } })); }
  function updateSession<K extends keyof ReviewData["session"]>(key: K, value: ReviewData["session"][K]) { setData((current) => ({ ...current, session: { ...current.session, [key]: value } })); }
  function updateModel(key: string, patch: Partial<ScoredAnswer>) { setData((current) => ({ ...current, overall: { ...current.overall, model: { ...current.overall.model, [key]: { ...current.overall.model[key], ...patch } } } })); }
  function updateVideoStage(video: VideoKey, key: string, patch: Partial<VideoStageAnswer>) { setData((current) => ({ ...current, overall: { ...current.overall, videos: { ...current.overall.videos, [video]: { ...current.overall.videos[video], [key]: { ...current.overall.videos[video][key], ...patch } } } } })); }
  function updateFramework(key: string, patch: Partial<ScoredAnswer>) { setData((current) => ({ ...current, overall: { ...current.overall, framework: { ...current.overall.framework, [key]: { ...current.overall.framework[key], ...patch } } } })); }

  async function submitReview() {
    if (!window.confirm("작성한 평가를 최종 제출할까요? 제출 후에도 같은 링크에서 내용을 수정하고 다시 제출할 수 있습니다.")) return;
    const submittedAt = new Date().toISOString();
    const finalized: ReviewData = { ...data, updatedAt: submittedAt, submissionStatus: "submitted", submittedAt };
    setData(finalized); window.localStorage.setItem(storageKey, JSON.stringify(finalized)); setSyncStatus("saving");
    try {
      await setDoc(doc(firestore, "expertReviewResponses", reviewToken), { ...finalized, serverUpdatedAt: serverTimestamp() }, { merge: true });
      setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })); setSyncStatus("saved"); window.alert("평가가 안전하게 제출되었습니다.");
    } catch { setSyncStatus("error"); window.alert("기기에는 임시 저장되었지만 서버 제출에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 눌러주세요."); }
  }

  return <section className="review-workspace" id="review-workspace" aria-labelledby="review-title">
    <div className="review-topline"><div><p className="eyebrow">E·V·C MODEL · STRUCTURED EXPERT REVIEW</p><h2 id="review-title">E·V·C 청중 상태 모델 및<br />백채널 표현 구조 전문가 평가</h2><p>사용자 실험에 앞서 발표 수행정보를 바탕으로 AI 청중의 E·V·C 상태를 산출하고, 산출된 상태를 비언어적 백채널로 표현하는 구조를 점검합니다. 독립 평가와 후속 면담에서 수집한 의견을 바탕으로 프레임워크 V1을 V2로 개정합니다.</p></div><div className="progress-card"><span>필수 평가 항목 입력률</span><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div><small>{syncLabel}</small></div></div>

    <section className="form-section compact-section" aria-labelledby="expert-info-title"><div className="legend-like"><span>02</span><div><b id="expert-info-title">전문가 기본 정보</b><small>전문영역, 최종 학위, 소속 및 관련 경력을 확인합니다.</small></div></div><div className="form-grid two">
      <div className="field full"><span className="field-label">관련 전문영역 · 복수 선택 가능</span><div className="choice-row">{["발표·커뮤니케이션", "HCI·Human–AI Interaction", "XR 인터랙션·가상 에이전트", "기타"].map((value) => <label key={value} className="choice-chip"><input type="checkbox" checked={data.expert.expertise.includes(value)} onChange={(event) => { const expertise = event.target.checked ? [...data.expert.expertise, value] : data.expert.expertise.filter((item) => item !== value); updateExpert("expertise", expertise); }} /><span>{value}</span></label>)}</div></div>
      {data.expert.expertise.includes("기타") && <label className="field full"><span>기타 전문영역</span><input value={data.expert.otherExpertise} onChange={(event) => updateExpert("otherExpertise", event.target.value)} /></label>}
      <div className="field full"><span className="field-label">관련 분야 최종 학위</span><div className="choice-row">{["학사", "석사", "박사", "기타"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="highest-degree" checked={data.expert.highestDegree === value} onChange={() => updateExpert("highestDegree", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.highestDegree === "기타" && <label className="field full"><span>기타 최종 학위</span><input value={data.expert.otherDegree} onChange={(event) => updateExpert("otherDegree", event.target.value)} /></label>}
      <div className="field full"><span className="field-label">소속 유형</span><div className="choice-row">{["대학", "연구기관", "산업체", "기타"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="affiliation-type" checked={data.expert.affiliationType === value} onChange={() => updateExpert("affiliationType", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.affiliationType === "기타" && <label className="field full"><span>기타 소속 유형</span><input value={data.expert.otherAffiliation} onChange={(event) => updateExpert("otherAffiliation", event.target.value)} /></label>}
      <label className="field"><span>관련 경력</span><input inputMode="numeric" value={data.expert.careerYears} onChange={(event) => updateExpert("careerYears", event.target.value)} placeholder="연구·교육·실무 경력 총 연수" /></label>
      <div className="field"><span className="field-label">이해상충 여부</span><div className="choice-row">{["없음", "있음"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="conflict" checked={data.expert.conflict === value} onChange={() => updateExpert("conflict", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.conflict === "있음" && <label className="field full"><span>이해관계 내용</span><textarea rows={3} value={data.expert.conflictDetails} onChange={(event) => updateExpert("conflictDetails", event.target.value)} /></label>}
    </div></section>

    <section className="form-section compact-section" aria-labelledby="review-material-info-title">
      <div className="legend-like"><span>R1</span><div><b id="review-material-info-title">검토 자료 정보</b><small>검토일과 제공된 자료의 버전을 확인합니다.</small></div></div>
      <div className="form-grid three review-metadata-grid">
        <label className="field"><span>검토일</span><input type="date" value={data.session.reviewDate} onChange={(event) => updateSession("reviewDate", event.target.value)} /></label>
        <label className="field"><span>프레임워크 버전</span><input value={data.session.frameworkVersion} readOnly aria-readonly="true" /></label>
        <label className="field"><span>애니메이션 세트 버전</span><input value={data.session.animationSetVersion} onChange={(event) => updateSession("animationSetVersion", event.target.value)} placeholder="예: V1" /></label>
      </div>
    </section>

    <section className="form-section compact-section interview-schedule-section" aria-labelledby="interview-schedule-title">
      <div className="legend-like"><span>R2</span><div><b id="interview-schedule-title">후속 면담 일정</b><small>희망하는 면담 방식과 가능한 일정을 작성해주세요.</small></div></div>
      <div className="form-grid two">
        <div className="field full"><span className="field-label">면담 방식</span><div className="choice-row">{["대면", "비공개 온라인 화상회의(Zoom)"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="interview-mode" checked={data.session.interviewMode === value} onChange={() => updateSession("interviewMode", value)} /><span>{value}</span></label>)}</div></div>
        {data.session.interviewMode === "대면" && <>
          <label className="field"><span>희망 장소</span><input value={data.session.preferredLocation} onChange={(event) => updateSession("preferredLocation", event.target.value)} placeholder="예: 서울대학교 관악캠퍼스 또는 협의 가능한 장소" /></label>
          <label className="field"><span>가능한 날짜 및 시간 후보군</span><textarea rows={4} value={data.session.interviewAvailability} onChange={(event) => updateSession("interviewAvailability", event.target.value)} placeholder={"예: 2026년 9월 3일 14:00–17:00\n2026년 9월 5일 10:00–12:00"} /></label>
        </>}
        {data.session.interviewMode === "비공개 온라인 화상회의(Zoom)" && <label className="field full"><span>가능한 날짜 및 시간 후보군</span><textarea rows={4} value={data.session.interviewAvailability} onChange={(event) => updateSession("interviewAvailability", event.target.value)} placeholder={"예: 2026년 9월 3일 14:00–17:00\n2026년 9월 5일 10:00–12:00"} /></label>}
        <div className="field full recording-field">
          <span className="field-label">면담 녹음 여부</span>
          <p className="recording-notice">녹음에 동의한 경우 면담 내용을 전사하여 프레임워크 개발에 필요한 내용을 기록한 뒤 녹음 자료를 폐기합니다. 녹음에 동의하지 않아도 면담에 참여할 수 있습니다.</p>
          <div className="choice-row">{["녹음에 동의함(별도 동의 확인)", "녹음하지 않음"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="recording" checked={data.session.recording === value} onChange={() => updateSession("recording", value)} /><span>{value}</span></label>)}</div>
        </div>
      </div>
    </section>

    <section className="form-section reference-section" aria-labelledby="materials-title"><div className="legend-like"><span>03</span><div><b id="materials-title">제공 자료 및 검토 순서</b><small>독립 검토 전 제공되는 자료와 이후 진행 순서입니다.</small></div></div><div className="materials-layout"><article className="reference-card materials-card"><p className="reference-label">PROVIDED MATERIALS</p><h3>검토 전 제공되는 자료</h3><ul className="materials-list"><li>프레임워크 V1 개요</li><li>E·V·C 청중 상태 모델 설명 및 도식</li><li>발표 수행정보·평가 차원 코드북</li><li>발표 단계 구분과 시간 정보</li><li>단계별 평가 관점의 정의와 이론적 근거</li><li>VR 발표 영상 샘플 2개 및 구현 제약 설명</li></ul></article><div className="review-steps"><article><span>01</span><div><small>INDEPENDENT REVIEW</small><h3>1단계 독립 검토</h3><p>다른 전문가의 점수나 연구자의 선호를 알지 못한 상태에서 E·V·C 청중 상태 모델과 백채널 표현 구조를 평가하고, 두 개의 VR 발표 영상에서 발표 흐름에 따른 AI 청중의 반응을 검토합니다.</p></div></article><article><span>02</span><div><small>FOLLOW-UP INTERVIEW</small><h3>2단계 후속 면담</h3><p>점수의 근거와 발표 단계별 평가 관점 및 적용 근거, 발표 수행정보–청중 상태 산출 관계 및 청중 상태–백채널 표현 관계를 확인합니다. 또한 의미 해석의 자연스러움, 발표 흐름에 따른 반응 변화, 누락·중복 구성요소와 구현상 위험을 사례 중심으로 검토합니다.</p></div></article></div></div></section>

    <section className="form-section reference-section model-overview" aria-labelledby="model-title"><div className="legend-like"><span>04</span><div><b id="model-title">E·V·C 청중 상태 모델 및 백채널 표현 구조 개요</b><small>평가 대상 모델의 구성과 정보 흐름을 확인해주세요.</small></div></div><div className="model-target"><span>검토 대상</span><p>발표 수행정보를 바탕으로 AI 청중의 E·V·C 상태를 산출·갱신하고, 이를 비언어적 백채널로 표현하는 청중 상태 모델 및 표현 구조</p></div><div className="evc-grid"><article data-state="E"><span>E</span><small>ENGAGEMENT</small><h3>Engagement</h3><p>발표 상황과 발표자에게 주의를 기울이고 관여하는 정도</p></article><article data-state="V"><span>V</span><small>EVALUATIVE VALENCE</small><h3>Evaluative Valence</h3><p>발표 내용 또는 수행에 대한 긍정적·부정적 평가 방향</p></article><article data-state="C"><span>C</span><small>COGNITIVE CLARITY</small><h3>Cognitive Clarity</h3><p>발표 내용과 구조를 이해하는 정도</p></article></div><dl className="model-facts"><div><dt>발표 단계 구조</dt><dd>도입부, 연구 동기, 이론적 틀(선택), 연구 목적, 연구 방법, 연구 결과(선택), 연구 함의, 마무리</dd></div><div><dt>입력</dt><dd>발표 단계별 내용 평가 결과와 음성·시선 등 전달 수행 평가 결과</dd></div><div><dt>개별 에이전트 특성</dt><dd>발표 주제에 대한 관심도와 배경 지식</dd></div><div><dt>상태 산출 및 갱신</dt><dd>현재의 발표 수행정보, 이전 청중 상태 및 개별 에이전트 특성을 종합하여 E·V·C 상태를 산출하고 갱신</dd></div><div><dt>백채널 표현</dt><dd>E·V·C 상태를 표정·자세·시선·고개 움직임으로 표현</dd></div><div><dt>제공 예시</dt><dd>발표자의 수행에 실시간으로 반응하는 AI 청중이 포함된 VR 발표 영상 샘플 2개와 발표 단계 표시</dd></div></dl></section>

    <section className="form-section evaluation-section" aria-labelledby="model-evaluation-title"><div className="legend-like"><span>05</span><div><b id="model-evaluation-title">E·V·C 청중 상태 모델 및 백채널 표현 구조 평가</b><small>각 문항을 4점 척도로 평가하고 필요한 경우 근거와 수정안을 작성해주세요.</small></div></div><div className="review-scale-note"><b>4점 척도</b><span data-score="1">1 전혀 적절하지 않음</span><span data-score="2">2 보완이 많이 필요함</span><span data-score="3">3 대체로 적절함</span><span data-score="4">4 매우 적절함</span><em>의미 범위 이탈 위험: 1 매우 높음 · 2 높은 편 · 3 낮은 편 · 4 매우 낮음</em></div><ul className="evaluation-guidance"><li>판단하기 어렵거나 자신의 전문영역 밖인 경우 점수 대신 ‘판단 어려움/전문영역 외’를 선택해주세요.</li><li>중대 문제는 사용자 실험 전에 반드시 수정해야 한다고 판단되는 의미·맥락·구현 또는 윤리상의 문제를 의미합니다.</li><li>판단 근거·수정안은 보완이 필요하거나 중대 문제가 있다고 판단한 항목을 중심으로 작성해주세요.</li></ul><div className="criteria-list fixed-criteria">{modelCriteria.map((criterion, index) => { const answer = data.overall.model[criterion.key]; return <article className="criterion" key={criterion.key}><div className="criterion-copy"><span className="criterion-index">{String(index + 1).padStart(2, "0")}</span><div><b>{criterion.label}</b><p>{criterion.statement}</p></div></div><ScorePicker label={`${criterion.label} 점수`} value={answer.score} disabled={answer.unable} onChange={(score) => updateModel(criterion.key, { score, unable: false })} /><div className="criterion-flags"><label><input type="checkbox" checked={answer.unable} onChange={(event) => updateModel(criterion.key, { unable: event.target.checked, score: event.target.checked ? null : answer.score })} /> 판단 어려움/전문영역 외</label><label className="critical-check"><input type="checkbox" checked={answer.critical} onChange={(event) => updateModel(criterion.key, { critical: event.target.checked })} /> 중대 문제</label></div><label className="field criterion-note"><span>판단 근거·수정안</span><textarea rows={2} value={answer.comment} onChange={(event) => updateModel(criterion.key, { comment: event.target.value })} /></label></article>; })}</div><div className="model-summary"><div className="field"><span className="field-label">종합 권고</span><div className="choice-row">{["현행 유지", "일부 수정", "구조 수정", "추가 검토"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="model-recommendation" checked={data.overall.modelRecommendation === value} onChange={() => setData((current) => ({ ...current, overall: { ...current.overall, modelRecommendation: value } }))} /><span>{value}</span></label>)}</div></div><div className="field"><span>판단 확신 · 1 낮음–4 높음</span><ScorePicker label="판단 확신" value={data.overall.confidence} onChange={(confidence) => setData((current) => ({ ...current, overall: { ...current.overall, confidence } }))} /></div><label className="field full"><span>핵심 수정안</span><textarea rows={3} value={data.overall.coreRevision} onChange={(event) => setData((current) => ({ ...current, overall: { ...current.overall, coreRevision: event.target.value } }))} /></label><label className="field full"><span>누락·중복 구성요소</span><textarea rows={3} value={data.overall.missingDuplicate} onChange={(event) => setData((current) => ({ ...current, overall: { ...current.overall, missingDuplicate: event.target.value } }))} /></label></div></section>

    <section className="form-section video-evaluation-section" aria-labelledby="video-evaluation-title"><div className="legend-like"><span>05-1</span><div><b id="video-evaluation-title">VR 발표 영상 샘플별 AI 청중 반응 검토</b><small>영상을 재생하면서 각 발표 단계의 청중 반응을 바로 평가해주세요.</small></div></div><div className="video-instructions"><p>두 개의 VR 발표 영상 샘플을 각각 약 3분 동안 연속하여 확인합니다. 영상 하단에는 현재 발표 단계만 표시되며 E·V·C 상태값은 제시하지 않습니다. AI 청중의 반응이 발표 내용과 전달 방식에 맞게 자연스럽게 나타나는지, 발표가 진행됨에 따라 청중 전체의 반응이 자연스럽게 유지되고 변화하는지를 평가해주세요.</p></div><details className="appraisal-guide" open><summary>단계별 평가 관점과 이론적 근거</summary><p>아래의 관점은 Scherer의 구성요소 과정 모델(Component Process Model)에서 제안한 자극 평가 점검(stimulus evaluation checks)을 발표 단계의 기능에 적용한 연구자 제안입니다. 이론이 각 발표 단계와 평가 관점의 일대일 대응을 확정한 것은 아니며, 본 검토에서는 적용의 적절성, 누락 및 중복을 함께 확인합니다.</p><div className="appraisal-grid">{appraisalDefinitions.map((item) => <article key={item.term}><h3>{item.term} <small>{item.english}</small></h3><p>{item.description}</p></article>)}</div><small className="theory-source">Scherer (2001), Appraisal Processes in Emotion, pp. 92–120; Scherer (2009), Cognition and Emotion, 23(7), 1307–1351.</small></details>
      {(["A", "B"] as VideoKey[]).map((video) => <article className="video-sample" key={video}><header><div><span>VIDEO SAMPLE</span><h3>영상 샘플 {video}</h3></div><p>영상 재생과 단계별 평가를 같은 화면에서 진행할 수 있습니다.</p></header><div className="video-review-layout"><aside className="video-player-column"><div className="video-player-sticky">{videoAvailable[video] !== false ? <video controls playsInline preload="metadata" aria-label={`영상 샘플 ${video}`} onCanPlay={() => setVideoAvailable((current) => ({ ...current, [video]: true }))} onError={() => setVideoAvailable((current) => ({ ...current, [video]: false }))}><source src={`./videos/sample-${video.toLowerCase()}.mp4`} type="video/mp4" />이 브라우저에서는 영상을 재생할 수 없습니다.</video> : <div className="video-empty"><strong>영상 샘플 {video} 연결 대기</strong><p>영상 파일이 연결되면 이 자리에서 바로 재생할 수 있습니다.</p></div>}<div className="video-player-note"><span>약 3분</span><span>발표 단계 표시</span><span>E·V·C 상태값 비공개</span></div></div></aside><div className="video-stage-list">{presentationStages.map((stage, index) => { const answer = data.overall.videos[video][stage.key]; return <article className="stage-evaluation" key={stage.key}><div className="stage-head"><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{stage.name}</h4><small>{stage.requirement}</small></div><label className="field stage-time"><span>시간 구간</span><input value={answer.timeRange} onChange={(event) => updateVideoStage(video, stage.key, { timeRange: event.target.value })} placeholder="00:00–00:00" /></label></div><p className="stage-rationale">{stage.rationale}</p><div className="field"><span className="field-label">AI 청중 집단 반응의 자연성·적절성</span><div className="video-rating-row">{videoRatings.map((rating) => <label key={rating} className="choice-chip"><input type="radio" name={`video-${video}-${stage.key}`} checked={answer.rating === rating} onChange={() => updateVideoStage(video, stage.key, { rating })} /><span>{rating}</span></label>)}</div></div><label className="field"><span>보완 의견</span><textarea rows={2} value={answer.comment} onChange={(event) => updateVideoStage(video, stage.key, { comment: event.target.value })} /></label></article>; })}</div></div></article>)}
    </section>

    <fieldset className="form-section framework-evaluation"><legend><span>06</span> 프레임워크 전체 평가</legend><p className="section-help">1=전혀 적절하지 않음, 2=보완이 많이 필요함, 3=대체로 적절함, 4=매우 적절함으로 응답합니다.</p><div className="overall-list">{frameworkItems.map((item, index) => { const answer = data.overall.framework[item.key]; return <article className="overall-item" key={item.key}><span className="overall-number">{String(index + 1).padStart(2, "0")}</span><div className="overall-copy"><b>{item.label}</b><p>{item.statement}</p></div><ScorePicker label={`${item.label} 점수`} value={answer.score} disabled={answer.unable} onChange={(score) => updateFramework(item.key, { score, unable: false })} /><label className="unable-check"><input type="checkbox" checked={answer.unable} onChange={(event) => updateFramework(item.key, { unable: event.target.checked, score: event.target.checked ? null : answer.score })} /> 판단 어려움/전문영역 외</label><label className="field full"><span>의견</span><textarea rows={2} value={answer.comment} onChange={(event) => updateFramework(item.key, { comment: event.target.value })} /></label></article>; })}</div></fieldset>
    <div className="export-panel"><div><p className="eyebrow light">FINAL SUBMISSION</p><h3>{data.submissionStatus === "submitted" ? "평가가 제출되었습니다." : "작성한 평가를 최종 제출해주세요."}</h3><p>참여자 ID <strong>{participantId}</strong>로 저장됩니다. 제출 후에도 같은 링크에서 내용을 수정해 다시 제출할 수 있습니다.</p></div><div className="export-actions"><button type="button" className="button primary" onClick={submitReview}>{data.submissionStatus === "submitted" ? "수정 내용 다시 제출" : "검토 완료 제출"} <span>→</span></button></div></div>
  </section>;
}
