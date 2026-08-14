"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";
import { emptyConsentRecord, ExpertConsentGate } from "./expert-consent-gate";
import type { ConsentRecord } from "./expert-consent-gate";

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
    systemBuildVersion: string;
    videoSampleVersion: string;
    interviewMode: string;
    preferredLocation: string;
    interviewAvailability: string;
    recording: string;
    consent: ConsentRecord;
  };
  ruleEvaluations: unknown[];
  overall: SurveyState;
};

const DEFAULT_FRAMEWORK_VERSION = "V1";
const DEFAULT_VIDEO_SAMPLE_VERSION = "V1";
const SYSTEM_BUILD_VERSION = import.meta.env.VITE_SYSTEM_BUILD_VERSION || "local-dev";

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
  { key: "overallCoherence", label: "전체 구조의 일관성", statement: "발표 수행정보 입력, E·V·C 상태 산출·갱신 및 백채널 표현으로 이어지는 전체 구조가 논리적으로 연결되어 있다." },
  { key: "timingAppropriateness", label: "반응 시점의 적절성", statement: "반응 발생 시점, 지연시간, 지속시간 및 쿨다운 원칙이 실제 발표 상황에서 자연스럽다." },
  { key: "intensityFrequency", label: "반응 강도·빈도의 적절성", statement: "백채널의 강도와 반복 빈도에 관한 원칙이 과도하거나 부족하지 않다." },
  { key: "agentDistribution", label: "에이전트 분배의 적절성", statement: "반응하는 에이전트의 수와 배분 방식이 개별 에이전트의 차이를 반영하면서 자연스러운 청중 집단 반응을 형성한다." },
  { key: "trainingFit", label: "발표 훈련 목적 적합성", statement: "긍정적·중립적·비판적 반응의 구성과 범위가 발표 훈련의 목적에 적절하다." },
  { key: "exceptionHandling", label: "예외 처리의 충분성", statement: "오탐, 불확실성 및 상충하는 수행 신호가 발생했을 때의 반응 생략·유지·전환 원칙이 충분하다." },
  { key: "implementationTraceability", label: "구현 및 추적 가능성", statement: "프레임워크를 실제 VR 발표 훈련 시스템에 일관되게 구현하고, 수행정보·청중 상태·백채널 표현의 연결 과정을 기록·추적·설명할 수 있다." },
];

const legacyVideoStageKeys = ["introduction", "motivation", "theory", "purpose", "method", "results", "implications", "closing"];
const videoStages = [
  { key: "introduction", label: "도입부", status: "필수", perspectives: "새로움 · 내재적 쾌·불쾌", rationale: "주의 환기와 내용·표현 자체가 주는 즉각적 첫인상" },
  { key: "motivation", label: "연구 동기", status: "필수", perspectives: "목표 관련성", rationale: "연구 필요성이 청중의 관심·필요·청취 목적과 연결되는 정도" },
  { key: "theory", label: "이론적 틀", status: "선택", perspectives: "규범·자기 일치성", rationale: "학문적 규범 및 청중의 이론적 관점과 부합하는 정도" },
  { key: "purpose", label: "연구 목적", status: "필수", perspectives: "목표 관련성 · 규범·자기 일치성", rationale: "연구목적이 청중의 관심·청취 목적 및 가치·학문적 규범과 부합하는 정도" },
  { key: "method", label: "연구 방법", status: "필수", perspectives: "목표 기여성·저해성 · 대처 가능성", rationale: "연구방법이 연구목적 달성에 기여하며 제시된 문제에 통제·대응할 수 있는 정도" },
  { key: "results", label: "연구 결과", status: "선택", perspectives: "새로움 · 내재적 쾌·불쾌 · 목표 관련성 · 목표 기여성·저해성", rationale: "예상 밖 정보와 즉각적 인상, 청중의 관심·목적 및 연구목적 달성에 대한 기여 정도" },
  { key: "implications", label: "연구 함의", status: "필수", perspectives: "목표 관련성 · 규범·자기 일치성", rationale: "함의의 활용 가능성과 중요성이 청중의 관심·목적 및 가치·학문적 규범과 부합하는 정도" },
  { key: "closing", label: "마무리", status: "필수", perspectives: "누적된 목표 기여성·저해성 · 누적된 규범·자기 일치성", rationale: "발표 전반이 청중의 청취 목적을 충족하며 기준·관점과 부합하는 정도" },
] as const;

const appraisalPerspectives = [
  { label: "새로움", english: "novelty", description: "해당 구간의 갑작스러움·낯섦 또는 예상과의 불일치가 청중의 주의를 새롭게 환기하는 정도" },
  { label: "내재적 쾌·불쾌", english: "intrinsic pleasantness", description: "목표 달성 여부와 별개로 내용이나 표현 자체가 즉각적인 긍정적 또는 부정적 인상을 주는 정도" },
  { label: "목표 관련성", english: "goal relevance", description: "내용이 청중의 현재 관심, 필요 또는 발표를 듣는 목적과 관련되는 정도" },
  { label: "목표 기여성·저해성", english: "goal conduciveness/obstructiveness", description: "내용이나 제안이 청중의 목표 또는 연구목적 달성에 도움이 되거나 방해된다고 판단하는 정도" },
  { label: "대처 가능성", english: "coping potential", description: "제시된 사건이나 문제의 결과를 청중 또는 관련 주체가 통제하거나 이에 적응·대응할 수 있다고 판단하는 정도" },
  { label: "규범·자기 일치성", english: "norm/self compatibility", description: "내용과 주장이 사회적·학문적 규범 및 청중 자신의 가치·기준·관점과 부합하는 정도" },
];

function todayInKorea() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}
function newScoredAnswer(): ScoredAnswer { return { score: null, unable: false, comment: "", critical: false }; }
function newVideoStageAnswer(): VideoStageAnswer { return { timeRange: "", rating: "", comment: "" }; }
function initialSurveyState(): SurveyState {
  const emptyVideos = () => Object.fromEntries(legacyVideoStageKeys.map((key) => [key, newVideoStageAnswer()]));
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
  const mergeVideo = (key: VideoKey) => Object.fromEntries(legacyVideoStageKeys.map((stageKey) => [stageKey, { ...newVideoStageAnswer(), ...(parsed.videos?.[key]?.[stageKey] ?? {}) }]));
  const currentModelKeys = new Set(modelCriteria.map((item) => item.key));
  const currentFrameworkKeys = new Set(frameworkItems.map((item) => item.key));
  const retiredModelAnswers = Object.fromEntries(Object.entries(parsed.model ?? {}).filter(([key]) => !currentModelKeys.has(key)));
  const retiredFrameworkAnswers = Object.fromEntries(Object.entries(parsed.framework ?? {}).filter(([key]) => !currentFrameworkKeys.has(key)));
  return {
    ...defaults,
    ...parsed,
    model: mergeScored(modelCriteria, parsed.model),
    videos: { A: mergeVideo("A"), B: mergeVideo("B") },
    framework: mergeScored(frameworkItems, parsed.framework),
    legacyResponses: {
      ...(parsed.legacyResponses ?? {}), ...legacyEntries,
      ...(Object.keys(retiredModelAnswers).length ? { retiredModelAnswers } : {}),
      ...(Object.keys(retiredFrameworkAnswers).length ? { retiredFrameworkAnswers } : {}),
    },
  };
}
function initialData(participantId: string): ReviewData {
  return {
    schemaVersion: "1.1", participantId, updatedAt: new Date().toISOString(), submissionStatus: "draft", submittedAt: null,
    expert: { expertise: [], otherExpertise: "", highestDegree: "", otherDegree: "", careerYears: "", affiliationType: "", otherAffiliation: "", conflict: "없음", conflictDetails: "" },
    session: {
      reviewDate: todayInKorea(), frameworkVersion: DEFAULT_FRAMEWORK_VERSION,
      systemBuildVersion: SYSTEM_BUILD_VERSION, videoSampleVersion: DEFAULT_VIDEO_SAMPLE_VERSION,
      interviewMode: "", preferredLocation: "", interviewAvailability: "", recording: "",
      consent: emptyConsentRecord(todayInKorea()),
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
      frameworkVersion: DEFAULT_FRAMEWORK_VERSION,
      systemBuildVersion: SYSTEM_BUILD_VERSION,
      videoSampleVersion: DEFAULT_VIDEO_SAMPLE_VERSION,
      interviewMode,
      preferredLocation: parsed.session?.preferredLocation ?? "",
      interviewAvailability: parsed.session?.interviewAvailability ?? "",
      recording,
      consent: {
        ...defaults.session.consent,
        ...(parsed.session?.consent ?? {}),
        confirmations: { ...defaults.session.consent.confirmations, ...(parsed.session?.consent?.confirmations ?? {}) },
      },
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
    const videos = (["A", "B"] as VideoKey[]).reduce((total, video) => total + videoStages.filter((stage) => data.overall.videos[video][stage.key].rating).length, 0);
    const framework = Object.values(data.overall.framework).filter((answer) => answer.score || answer.unable).length;
    return Math.round(((model + videos + framework) / (modelCriteria.length + (videoStages.length * 2) + frameworkItems.length)) * 100);
  }, [data.overall]);

  const videoComplete = (video: VideoKey) => videoStages.every((stage) => Boolean(data.overall.videos[video][stage.key].rating));
  const videoAComplete = videoComplete("A");
  const videoBComplete = videoComplete("B");

  function updateExpert<K extends keyof ReviewData["expert"]>(key: K, value: ReviewData["expert"][K]) { setData((current) => ({ ...current, expert: { ...current.expert, [key]: value } })); }
  function updateSession<K extends keyof ReviewData["session"]>(key: K, value: ReviewData["session"][K]) { setData((current) => ({ ...current, session: { ...current.session, [key]: value } })); }
  function updateModel(key: string, patch: Partial<ScoredAnswer>) { setData((current) => ({ ...current, overall: { ...current.overall, model: { ...current.overall.model, [key]: { ...current.overall.model[key], ...patch } } } })); }
  function updateVideoStage(video: VideoKey, stage: string, patch: Partial<VideoStageAnswer>) { setData((current) => ({ ...current, overall: { ...current.overall, videos: { ...current.overall.videos, [video]: { ...current.overall.videos[video], [stage]: { ...current.overall.videos[video][stage], ...patch } } } } })); }
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

  function completeConsent(consent: ConsentRecord) {
    setData((current) => ({
      ...current,
      updatedAt: consent.completedAt || new Date().toISOString(),
      session: {
        ...current.session,
        consent,
        recording: consent.recordingConsent === "동의함" ? "녹음에 동의함(별도 동의 확인)" : "녹음하지 않음",
      },
    }));
  }

  if (!restored) return <section className="consent-loading" role="status"><span>Re:hear</span><p>저장된 참여 정보를 확인하고 있습니다.</p></section>;
  if (!data.session.consent.completedAt) return <ExpertConsentGate participantId={participantId} consentDate={todayInKorea()} onComplete={completeConsent} />;

  return <section className="review-workspace" id="review-workspace" aria-labelledby="review-title">
    <div className="review-topline"><div><p className="eyebrow">E·V·C MODEL · STRUCTURED EXPERT REVIEW</p><h2 id="review-title">E·V·C 청중 상태 모델<br />전문가 평가</h2><p>사용자 실험에 앞서 발표 수행정보를 바탕으로 AI 청중의 상태를 산출하고 이를 비언어적 백채널로 표현하는 E·V·C 청중 상태 모델을 점검하고 보완합니다. 독립 평가와 후속 면담에서 수집한 의견을 바탕으로 프레임워크 V1을 V2로 개정합니다.</p></div><div className="progress-card"><span>필수 평가 항목 입력률</span><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div><small>{syncLabel}</small></div></div>

    <section className="form-section compact-section" aria-labelledby="expert-info-title"><div className="legend-like"><span>01</span><div><b id="expert-info-title">전문가 기본 정보</b><small>전문영역, 소속 및 관련 경력을 확인합니다.</small></div></div><div className="form-grid two">
      <div className="field full"><span className="field-label">관련 전문영역 · 복수 선택 가능</span><div className="choice-row">{["발표·커뮤니케이션", "HCI·Human–AI Interaction", "XR 인터랙션·가상 에이전트", "기타"].map((value) => <label key={value} className="choice-chip"><input type="checkbox" checked={data.expert.expertise.includes(value)} onChange={(event) => { const expertise = event.target.checked ? [...data.expert.expertise, value] : data.expert.expertise.filter((item) => item !== value); updateExpert("expertise", expertise); }} /><span>{value}</span></label>)}</div></div>
      {data.expert.expertise.includes("기타") && <label className="field full"><span>기타 전문영역</span><input value={data.expert.otherExpertise} onChange={(event) => updateExpert("otherExpertise", event.target.value)} /></label>}
      <div className="field full"><span className="field-label">관련 분야 최종 학위</span><div className="choice-row">{["학사", "석사", "박사", "기타"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="highest-degree" checked={data.expert.highestDegree === value} onChange={() => updateExpert("highestDegree", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.highestDegree === "기타" && <label className="field full"><span>기타 최종 학위</span><input value={data.expert.otherDegree} onChange={(event) => updateExpert("otherDegree", event.target.value)} /></label>}
      <div className="field full"><span className="field-label">소속 유형</span><div className="choice-row">{["대학", "연구기관", "산업체", "기타"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="affiliation-type" checked={data.expert.affiliationType === value} onChange={() => updateExpert("affiliationType", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.affiliationType === "기타" && <label className="field full"><span>기타 소속 유형</span><input value={data.expert.otherAffiliation} onChange={(event) => updateExpert("otherAffiliation", event.target.value)} /></label>}
      <label className="field"><span>관련 경력</span><input inputMode="numeric" value={data.expert.careerYears} onChange={(event) => updateExpert("careerYears", event.target.value)} placeholder="예: 10년" /></label>
      <div className="field"><span className="field-label">이해상충 여부</span><div className="choice-row">{["없음", "있음"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="conflict" checked={data.expert.conflict === value} onChange={() => updateExpert("conflict", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.conflict === "있음" && <label className="field full"><span>이해관계 내용</span><textarea rows={3} value={data.expert.conflictDetails} onChange={(event) => updateExpert("conflictDetails", event.target.value)} /></label>}
    </div></section>

    <section className="form-section compact-section" aria-labelledby="review-material-info-title">
      <div className="legend-like"><span>02</span><div><b id="review-material-info-title">검토 자료 정보</b><small>작성 날짜는 자동으로 입력되며 필요한 경우 변경할 수 있습니다.</small></div></div>
      <div className="form-grid review-date-grid">
        <label className="field"><span>검토일</span><input type="date" value={data.session.reviewDate} onChange={(event) => updateSession("reviewDate", event.target.value)} /></label>
      </div>
    </section>

    <section className="form-section compact-section interview-schedule-section" aria-labelledby="interview-schedule-title">
      <div className="legend-like"><span>03</span><div><b id="interview-schedule-title">후속 면담 일정</b><small>희망하는 면담 방식과 가능한 일정을 작성해주세요.</small></div></div>
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

    <section className="form-section reference-section" aria-labelledby="materials-title"><div className="legend-like"><span>04</span><div><b id="materials-title">제공 자료 및 검토 순서</b><small>독립 검토 전 제공되는 자료와 이후 진행 순서입니다.</small></div></div><div className="materials-layout"><article className="reference-card materials-card"><p className="reference-label">PROVIDED MATERIALS</p><h3>검토 전 제공되는 자료</h3><ul className="materials-list"><li>프레임워크 V1 개요</li><li>E·V·C 청중 상태 모델 설명 및 도식</li><li>발표 수행정보·평가 차원 코드북</li><li>발표 단계 구분과 시간 정보</li><li>단계별 평가 관점의 정의와 이론적 근거</li><li>AI 청중이 포함된 VR 발표 영상 샘플 2개</li><li>구현 제약 설명</li></ul></article><div className="review-steps"><article><span>01</span><div><small>INDEPENDENT REVIEW</small><h3>1단계 독립 검토</h3><p>다른 전문가의 점수나 연구자의 선호를 알지 못한 상태에서 E·V·C 청중 상태 모델과 백채널 표현 구조를 평가하고, 두 개의 VR 발표 영상에서 발표 흐름에 따른 AI 청중의 반응을 검토합니다.</p></div></article><article><span>02</span><div><small>FOLLOW-UP INTERVIEW</small><h3>2단계 후속 면담</h3><p>점수의 근거, 발표 단계별 평가 관점 및 적용 근거, 수행정보–청중 상태–백채널 표현 관계와 구현상 위험을 구체적 사례 중심으로 확인합니다.</p></div></article></div></div></section>

    <section className="form-section reference-section model-overview" aria-labelledby="model-title"><div className="legend-like"><span>05</span><div><b id="model-title">E·V·C 청중 상태 모델 및 백채널 표현 구조 개요</b><small>평가 대상 모델의 구성과 정보 흐름을 확인해주세요.</small></div></div><div className="model-target"><span>검토 대상</span><p>발표 수행정보를 바탕으로 AI 청중의 E·V·C 상태를 산출·갱신하고, 이를 비언어적 백채널로 표현하는 청중 상태 모델 및 표현 구조</p></div><div className="evc-grid"><article data-state="E"><span>E</span><small>ENGAGEMENT</small><h3>Engagement</h3><p>발표 상황과 발표자에게 주의를 기울이고 관여하는 정도</p></article><article data-state="V"><span>V</span><small>EVALUATIVE VALENCE</small><h3>Evaluative Valence</h3><p>발표 내용 또는 수행에 대한 긍정적·부정적 평가 방향</p></article><article data-state="C"><span>C</span><small>COGNITIVE CLARITY</small><h3>Cognitive Clarity</h3><p>발표 내용과 구조를 이해하는 정도</p></article></div><div className="presentation-stage-strip" aria-label="발표 단계 구조">{videoStages.map((stage, index) => <span key={stage.key}><b>{String(index + 1).padStart(2, "0")}</b>{stage.label}<small>{stage.status}</small></span>)}</div><dl className="model-facts"><div><dt>입력</dt><dd>발표 단계별 내용 평가 결과와 음성·머리 방향 기반 시선 등 전달 수행 평가 결과</dd></div><div><dt>개별 에이전트 특성</dt><dd>발표 주제에 대한 관심도와 배경지식</dd></div><div><dt>상태 산출 및 갱신</dt><dd>현재의 발표 수행정보, 이전 청중 상태 및 개별 에이전트 특성을 종합하여 각 AI 청중 에이전트의 E·V·C 상태를 산출하고 갱신</dd></div><div><dt>백채널 표현</dt><dd>E·V·C 상태를 표정·자세·시선·고개 움직임으로 표현</dd></div><div><dt>제공 예시</dt><dd>발표자의 수행에 실시간으로 반응하는 AI 청중이 포함된 VR 발표 영상 샘플 2개와 발표 단계 표시</dd></div></dl><details className="theory-references"><summary>관련 이론 참고문헌 확인하기</summary><p>E·V·C는 본 연구에서 구성한 청중 상태 모델입니다. 아래 문헌은 상태 평가 과정과 동적인 반응 갱신에 관한 관련 이론적 배경을 확인하기 위한 자료입니다.</p><ul><li><a href="https://doi.org/10.1093/oso/9780195130072.003.0005" target="_blank" rel="noreferrer">Scherer (2001), Appraisal Considered as a Process of Multilevel Sequential Checking</a><span>Oxford University Press · DOI 원문 페이지</span></li><li><a href="https://doi.org/10.1080/02699930902928969" target="_blank" rel="noreferrer">Scherer (2009), The Dynamic Architecture of Emotion</a><span>Cognition and Emotion, 23(7), 1307–1351 · DOI 원문 페이지</span></li></ul></details></section>

    <section className="form-section evaluation-section" aria-labelledby="model-evaluation-title"><div className="legend-like"><span>06</span><div><b id="model-evaluation-title">E·V·C 청중 상태 모델 평가</b><small>각 문항을 4점 척도로 평가하고 필요한 경우 근거와 수정안을 작성해주세요.</small></div></div><div className="review-scale-note"><b>4점 척도</b><span data-score="1">1 전혀 적절하지 않음</span><span data-score="2">2 보완이 많이 필요함</span><span data-score="3">3 대체로 적절함</span><span data-score="4">4 매우 적절함</span><em>오해 위험: 1 매우 높음 · 2 높은 편 · 3 낮은 편 · 4 매우 낮음</em></div><ul className="evaluation-guidance"><li>판단하기 어렵거나 자신의 전문영역 밖인 경우 점수 대신 ‘판단 어려움/전문영역 외’를 선택해주세요.</li><li>중대 문제는 사용자 실험 전에 반드시 수정해야 한다고 판단되는 의미·맥락·구현 또는 윤리상의 문제를 의미합니다.</li><li>판단 근거·수정안은 보완이 필요하거나 중대 문제가 있다고 판단한 항목을 중심으로 작성해주세요.</li></ul><div className="criteria-list fixed-criteria">{modelCriteria.map((criterion, index) => { const answer = data.overall.model[criterion.key]; return <article className="criterion" key={criterion.key}><div className="criterion-copy"><span className="criterion-index">{String(index + 1).padStart(2, "0")}</span><div><b>{criterion.label}</b><p>{criterion.statement}</p></div></div><ScorePicker label={`${criterion.label} 점수`} value={answer.score} disabled={answer.unable} onChange={(score) => updateModel(criterion.key, { score, unable: false })} /><div className="criterion-flags"><label className={`unable-check ${answer.unable ? "is-selected" : ""}`}><input type="checkbox" checked={answer.unable} onChange={(event) => updateModel(criterion.key, { unable: event.target.checked, score: event.target.checked ? null : answer.score })} /> 판단 어려움/전문영역 외</label><label className={`critical-check ${answer.critical ? "is-selected" : ""}`}><input type="checkbox" checked={answer.critical} onChange={(event) => updateModel(criterion.key, { critical: event.target.checked })} /> 중대 문제</label></div><label className="field criterion-note"><span>판단 근거·수정안</span><textarea rows={2} value={answer.comment} onChange={(event) => updateModel(criterion.key, { comment: event.target.value })} /></label></article>; })}</div><div className="model-summary"><div className="field"><span className="field-label">종합 권고</span><div className="choice-row">{["현행 유지", "일부 수정", "구조 수정", "추가 검토"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="model-recommendation" checked={data.overall.modelRecommendation === value} onChange={() => setData((current) => ({ ...current, overall: { ...current.overall, modelRecommendation: value } }))} /><span>{value}</span></label>)}</div></div><div className="field"><span>판단 확신 · 1 낮음–4 높음</span><ScorePicker label="판단 확신" value={data.overall.confidence} onChange={(confidence) => setData((current) => ({ ...current, overall: { ...current.overall, confidence } }))} /></div><label className="field full"><span>핵심 수정안</span><textarea rows={3} value={data.overall.coreRevision} onChange={(event) => setData((current) => ({ ...current, overall: { ...current.overall, coreRevision: event.target.value } }))} /></label><label className="field full"><span>누락·중복 구성요소</span><textarea rows={3} value={data.overall.missingDuplicate} onChange={(event) => setData((current) => ({ ...current, overall: { ...current.overall, missingDuplicate: event.target.value } }))} /></label></div></section>

    <section className="form-section framework-evaluation" aria-labelledby="framework-evaluation-title">
      <div className="legend-like"><span>07</span><div><b id="framework-evaluation-title">영상 샘플 및 프레임워크 전체 평가</b><small>영상 1과 영상 2를 순서대로 시청·평가한 뒤 프레임워크 전체 평가를 작성해주세요.</small></div></div>
      <nav className="video-review-stepper" aria-label="영상 평가 순서">
        <button type="button" className={!videoAComplete ? "active" : "done"} onClick={() => document.getElementById("video-review-a")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>01</span><div><b>영상 1 시청·평가</b><small>{videoAComplete ? "평가 완료" : "먼저 진행"}</small></div></button>
        <button type="button" className={videoAComplete && !videoBComplete ? "active" : videoBComplete ? "done" : "waiting"} onClick={() => document.getElementById("video-review-b")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>02</span><div><b>영상 2 시청·평가</b><small>{videoBComplete ? "평가 완료" : videoAComplete ? "다음 단계" : "영상 1 평가 후 진행"}</small></div></button>
        <button type="button" className={videoAComplete && videoBComplete ? "active" : "waiting"} onClick={() => document.getElementById("framework-overall-review")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>03</span><div><b>프레임워크 전체 평가</b><small>{videoAComplete && videoBComplete ? "작성 가능" : "두 영상 평가 후 진행"}</small></div></button>
      </nav>
      <div className="framework-review-layout">
        <section className="framework-video-section" aria-labelledby="video-samples-title">
          <div className="framework-video-heading"><p className="reference-label">VIDEO REVIEW · STEP 01–02</p><h3 id="video-samples-title">VR 발표 영상 샘플별 AI 청중 반응 검토</h3><p>각 영상은 약 3분이며, 영상 하단에는 현재 발표 단계만 표시되고 E·V·C 상태값은 제시되지 않습니다. 발표 내용과 전달 방식에 맞게 AI 청중의 반응이 자연스럽게 나타나고 변화하는지 단계별로 평가해주세요.</p></div>
          <details className="appraisal-guide"><summary>단계별 평가 관점의 정의와 적용 범위 확인하기</summary><p>아래 평가 관점은 Scherer의 구성요소 과정 모델에서 제시된 자극 평가 점검을 발표 맥락에 맞게 조작적으로 적용한 연구자 제안입니다. 특정 발표 단계와 일대일로 확정된 관계가 아니며, 여러 평가 관점은 발표 전반에서 반복적·누적적으로 작동할 수 있습니다.</p><div>{appraisalPerspectives.map((perspective) => <article key={perspective.label}><b>{perspective.label}</b><small>{perspective.english}</small><p>{perspective.description}</p></article>)}</div></details>
          <div className="framework-video-list">{(["A", "B"] as VideoKey[]).map((video, videoIndex) => {
            const isComplete = videoComplete(video);
            const completedStages = videoStages.filter((stage) => data.overall.videos[video][stage.key].rating).length;
            const nextTarget = video === "A" ? "video-review-b" : "framework-overall-review";
            return <article className={`framework-video-card ${isComplete ? "is-complete" : ""}`} id={`video-review-${video.toLowerCase()}`} key={video}>
              <header><span>{String(videoIndex + 1).padStart(2, "0")}</span><div><small>VIDEO SAMPLE {video}</small><h4>영상 {videoIndex + 1} 시청·단계별 평가</h4></div><em>{isComplete ? "8단계 평가 완료" : `${completedStages}/8단계 입력`}</em></header>
              <div className="framework-player">{videoAvailable[video] !== false ? <video key={video} controls playsInline preload="metadata" aria-label={`영상 샘플 ${videoIndex + 1}`} onCanPlay={() => setVideoAvailable((current) => ({ ...current, [video]: true }))} onError={() => setVideoAvailable((current) => ({ ...current, [video]: false }))}><source src={`./videos/sample-${video.toLowerCase()}.mp4`} type="video/mp4" />이 브라우저에서는 영상을 재생할 수 없습니다.</video> : <div className="video-empty"><span className="video-play-symbol" aria-hidden="true">▶</span><strong>영상 샘플 {videoIndex + 1} 연결 대기</strong><p>영상 파일이 연결되면 재생·일시정지·구간 탐색·전체화면 기능을 사용할 수 있습니다.</p></div>}</div>
              <div className="video-player-note"><span>현재 발표 단계 표시</span><span>AI 청중 집단 반응</span><span>E·V·C 상태값 비공개</span></div>
              <section className="video-inline-evaluation" aria-label={`영상 ${videoIndex + 1} 단계별 평가`}>
                <div className="video-evaluation-heading"><div><small>WATCH &amp; RATE</small><h5>영상 {videoIndex + 1} 단계별 평가</h5></div><span>{completedStages}/{videoStages.length} 단계</span></div>
                <div className="video-stage-list">{videoStages.map((stage, stageIndex) => { const answer = data.overall.videos[video][stage.key]; return <article className="stage-evaluation" key={stage.key}>
                  <div className="stage-head"><span>{String(stageIndex + 1).padStart(2, "0")}</span><div><small>{stage.status}</small><h4>{stage.label}</h4></div><label className="field stage-time"><span>시간 구간</span><input value={answer.timeRange} onChange={(event) => updateVideoStage(video, stage.key, { timeRange: event.target.value })} placeholder="예: 00:00–00:35" /></label></div>
                  <p className="stage-rationale"><b>{stage.perspectives}</b><span>{stage.rationale}</span></p>
                  <div className="field"><span className="field-label">AI 청중 집단 반응의 자연성·적절성</span><div className="video-rating-row">{["적절함", "부분적으로 적절함", "부적절함", "판단 어려움", "해당 없음"].map((rating) => <label className="choice-chip" key={rating}><input type="radio" name={`video-${video}-${stage.key}`} checked={answer.rating === rating} onChange={() => updateVideoStage(video, stage.key, { rating })} /><span>{rating}</span></label>)}</div></div>
                  <label className="field"><span>보완 의견</span><textarea rows={2} value={answer.comment} onChange={(event) => updateVideoStage(video, stage.key, { comment: event.target.value })} /></label>
                </article>; })}</div>
                <button type="button" className="video-next-button" onClick={() => document.getElementById(nextTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{video === "A" ? "영상 2로 이동" : "프레임워크 전체 평가로 이동"}<span>→</span></button>
              </section>
            </article>;
          })}</div>
        </section>
        <section className="framework-question-section" id="framework-overall-review" aria-labelledby="framework-questions-title">
          <div className="framework-question-heading"><p className="reference-label">STEP 03 · OVERALL EVALUATION</p><h3 id="framework-questions-title">프레임워크 전체 평가</h3><p>영상 1과 영상 2를 모두 확인하고 각각 평가한 뒤, 두 영상에서 확인한 내용을 종합하여 응답해주세요.</p></div>
          {!videoAComplete || !videoBComplete ? <p className="overall-prerequisite">위 단계에서 영상 1과 영상 2의 필수 평가 문항을 모두 입력하면 두 영상이 ‘평가 완료’로 표시됩니다.</p> : <p className="overall-ready">영상 1·2 평가 완료 · 전체 평가를 작성해주세요.</p>}
          <div className="overall-list">{frameworkItems.map((item, index) => { const answer = data.overall.framework[item.key]; return <article className="overall-item" key={item.key}><span className="overall-number">{String(index + 1).padStart(2, "0")}</span><div className="overall-copy"><b>{item.label}</b><p>{item.statement}</p></div><ScorePicker label={`${item.label} 점수`} value={answer.score} disabled={answer.unable} onChange={(score) => updateFramework(item.key, { score, unable: false })} /><label className={`unable-check ${answer.unable ? "is-selected" : ""}`}><input type="checkbox" checked={answer.unable} onChange={(event) => updateFramework(item.key, { unable: event.target.checked, score: event.target.checked ? null : answer.score })} /> 판단 어려움/전문영역 외</label><label className="field full"><span>의견</span><textarea rows={2} value={answer.comment} onChange={(event) => updateFramework(item.key, { comment: event.target.value })} /></label></article>; })}</div>
        </section>
      </div>
    </section>
    <div className="export-panel"><div><p className="eyebrow light">FINAL SUBMISSION</p><h3>{data.submissionStatus === "submitted" ? "평가가 제출되었습니다." : "작성한 평가를 최종 제출해주세요."}</h3><p>참여자 ID <strong>{participantId}</strong>로 저장됩니다. 제출 후에도 같은 링크에서 내용을 수정해 다시 제출할 수 있습니다.</p></div><div className="export-actions"><button type="button" className="button primary" onClick={submitReview}>{data.submissionStatus === "submitted" ? "수정 내용 다시 제출" : "검토 완료 제출"} <span>→</span></button></div></div>
  </section>;
}
