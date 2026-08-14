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
  { key: "inputConnection", label: "입력 연결 적절성", statement: "발표 내용 및 전달 수행정보가 E·V·C 청중 상태에 반영되는 방식이 이론적·실무적으로 적절하다." },
  { key: "stateUpdate", label: "상태 갱신 일관성", statement: "현재의 발표 수행정보와 이전 청중 상태를 반영하여 E·V·C 상태를 갱신하는 구조가 일관되고 납득 가능하다." },
  { key: "backchannelExpression", label: "백채널 표현 적절성", statement: "E·V·C 청중 상태가 표정·자세·시선·고개 움직임으로 적절하게 표현된다." },
  { key: "misunderstandingRisk", label: "오해 위험", statement: "모델에 따른 백채널이 의도와 다르게 해석되거나 부당한 평가로 느껴질 위험 수준은 어떠합니까?" },
];

const frameworkItems = [
  { key: "inputCoverage", label: "발표 수행정보 포괄성", statement: "발표 수행정보가 중요한 내용·전달 차원을 충분히 포함한다." },
  { key: "stateExpressionConnection", label: "상태–표현 연결", statement: "E·V·C 청중 상태와 백채널 표현 사이의 연결이 명확하고 일관된다." },
  { key: "responsePrinciples", label: "반응 원칙 일관성", statement: "반응의 시점·강도·빈도·에이전트 분배 원칙이 일관된다." },
  { key: "trainingRange", label: "발표 훈련 목적 적합성", statement: "긍정·중립·비판적 반응의 범위가 발표 훈련 목적에 적절하다." },
  { key: "exceptionPrinciples", label: "예외 원칙 충분성", statement: "오탐·불확실성·상충 신호가 발생했을 때의 예외 원칙이 충분하다." },
  { key: "implementationExplainability", label: "구현·설명 가능성", statement: "프레임워크를 실제 VR 발표 훈련 시스템에 구현하고 설명할 수 있다." },
];

const legacyVideoStageKeys = ["introduction", "motivation", "theory", "purpose", "method", "results", "implications", "closing"];

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
  const [activeVideo, setActiveVideo] = useState<VideoKey>("A");

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
    const framework = Object.values(data.overall.framework).filter((answer) => answer.score || answer.unable).length;
    return Math.round(((model + framework) / (modelCriteria.length + frameworkItems.length)) * 100);
  }, [data.overall]);

  function updateExpert<K extends keyof ReviewData["expert"]>(key: K, value: ReviewData["expert"][K]) { setData((current) => ({ ...current, expert: { ...current.expert, [key]: value } })); }
  function updateSession<K extends keyof ReviewData["session"]>(key: K, value: ReviewData["session"][K]) { setData((current) => ({ ...current, session: { ...current.session, [key]: value } })); }
  function updateModel(key: string, patch: Partial<ScoredAnswer>) { setData((current) => ({ ...current, overall: { ...current.overall, model: { ...current.overall.model, [key]: { ...current.overall.model[key], ...patch } } } })); }
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
    <div className="review-topline"><div><p className="eyebrow">E·V·C MODEL · STRUCTURED EXPERT REVIEW</p><h2 id="review-title">E·V·C 청중 상태 모델<br />전문가 평가</h2><p>사용자 실험에 앞서 발표 수행정보를 바탕으로 AI 청중의 상태를 산출하고 이를 비언어적 백채널로 표현하는 E·V·C 청중 상태 모델을 점검하고 보완합니다. 독립 평가와 후속 면담에서 수집한 의견을 바탕으로 프레임워크 V1을 V2로 개정합니다.</p></div><div className="progress-card"><span>필수 평가 항목 입력률</span><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div><small>{syncLabel}</small></div></div>

    <section className="form-section compact-section" aria-labelledby="expert-info-title"><div className="legend-like"><span>01</span><div><b id="expert-info-title">전문가 기본 정보</b><small>전문영역, 소속 및 관련 경력을 확인합니다.</small></div></div><div className="form-grid two">
      <div className="field full"><span className="field-label">관련 전문영역 · 복수 선택 가능</span><div className="choice-row">{["발표·커뮤니케이션", "HCI·Human–AI Interaction", "XR 인터랙션·가상 에이전트", "기타"].map((value) => <label key={value} className="choice-chip"><input type="checkbox" checked={data.expert.expertise.includes(value)} onChange={(event) => { const expertise = event.target.checked ? [...data.expert.expertise, value] : data.expert.expertise.filter((item) => item !== value); updateExpert("expertise", expertise); }} /><span>{value}</span></label>)}</div></div>
      {data.expert.expertise.includes("기타") && <label className="field full"><span>기타 전문영역</span><input value={data.expert.otherExpertise} onChange={(event) => updateExpert("otherExpertise", event.target.value)} /></label>}
      <div className="field full"><span className="field-label">소속 유형</span><div className="choice-row">{["대학", "연구기관", "산업체", "기타"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="affiliation-type" checked={data.expert.affiliationType === value} onChange={() => updateExpert("affiliationType", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.affiliationType === "기타" && <label className="field full"><span>기타 소속 유형</span><input value={data.expert.otherAffiliation} onChange={(event) => updateExpert("otherAffiliation", event.target.value)} /></label>}
      <label className="field"><span>관련 경력</span><input inputMode="numeric" value={data.expert.careerYears} onChange={(event) => updateExpert("careerYears", event.target.value)} placeholder="예: 10년" /></label>
      <div className="field"><span className="field-label">이해상충 여부</span><div className="choice-row">{["없음", "있음"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="conflict" checked={data.expert.conflict === value} onChange={() => updateExpert("conflict", value)} /><span>{value}</span></label>)}</div></div>
      {data.expert.conflict === "있음" && <label className="field full"><span>이해관계 내용</span><textarea rows={3} value={data.expert.conflictDetails} onChange={(event) => updateExpert("conflictDetails", event.target.value)} /></label>}
    </div></section>

    <section className="form-section compact-section" aria-labelledby="review-material-info-title">
      <div className="legend-like"><span>02</span><div><b id="review-material-info-title">검토 자료 정보</b><small>검토일과 제공된 자료의 버전을 확인합니다.</small></div></div>
      <div className="form-grid three review-metadata-grid">
        <label className="field"><span>검토일</span><input type="date" value={data.session.reviewDate} onChange={(event) => updateSession("reviewDate", event.target.value)} /></label>
        <label className="field"><span>프레임워크 버전</span><input className="locked-input" value={data.session.frameworkVersion} readOnly aria-readonly="true" tabIndex={-1} /></label>
        <label className="field"><span>애니메이션 세트 버전</span><input value={data.session.animationSetVersion} onChange={(event) => updateSession("animationSetVersion", event.target.value)} placeholder="예: V1" /></label>
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

    <section className="form-section reference-section" aria-labelledby="materials-title"><div className="legend-like"><span>04</span><div><b id="materials-title">제공 자료 및 검토 순서</b><small>독립 검토 전 제공되는 자료와 이후 진행 순서입니다.</small></div></div><div className="materials-layout"><article className="reference-card materials-card"><p className="reference-label">PROVIDED MATERIALS</p><h3>검토 전 제공되는 자료</h3><ul className="materials-list"><li>프레임워크 V1 개요</li><li>E·V·C 청중 상태 모델 설명 및 도식</li><li>발표 수행정보·평가 차원 코드북</li><li>대표 발표 맥락</li><li>실제 또는 목업 애니메이션 클립</li><li>구현 제약 설명</li></ul></article><div className="review-steps"><article><span>01</span><div><small>INDEPENDENT REVIEW</small><h3>1단계 독립 검토</h3><p>다른 전문가의 점수나 연구자의 선호를 알지 못한 상태에서 E·V·C 청중 상태 모델과 백채널 표현 구조에 대한 평가표를 작성합니다.</p></div></article><article><span>02</span><div><small>FOLLOW-UP INTERVIEW</small><h3>2단계 후속 면담</h3><p>점수의 근거, 모델에서 해석이 모호한 부분, 누락·중복된 구성요소, 백채널의 오해 가능성 및 구현상 위험을 구체적 사례 중심으로 확인합니다.</p></div></article></div></div></section>

    <section className="form-section reference-section model-overview" aria-labelledby="model-title"><div className="legend-like"><span>05</span><div><b id="model-title">E·V·C 청중 상태 모델 개요</b><small>평가 대상 모델의 구성과 정보 흐름을 확인해주세요.</small></div></div><div className="model-target"><span>검토 대상</span><p>발표 수행정보를 바탕으로 AI 청중의 상태를 산출하고 비언어적 백채널로 표현하는 E·V·C 청중 상태 모델</p></div><div className="evc-grid"><article data-state="E"><span>E</span><small>ENGAGEMENT</small><h3>Engagement</h3><p>발표 상황과 발표자에 대한 주의적 연결 정도</p></article><article data-state="V"><span>V</span><small>EVALUATIVE VALENCE</small><h3>Evaluative Valence</h3><p>발표 내용 또는 수행에 대한 긍정적·부정적 평가 방향</p></article><article data-state="C"><span>C</span><small>COGNITIVE CLARITY</small><h3>Cognitive Clarity</h3><p>발표 내용과 구조를 명확하게 이해하는 정도</p></article></div><dl className="model-facts"><div><dt>입력</dt><dd>발표 내용 평가 결과와 음성·시선 등 전달 평가 결과</dd></div><div><dt>상태 산출 및 갱신</dt><dd>현재의 발표 수행정보와 이전 청중 상태를 종합하여 E·V·C 상태를 산출하고 갱신</dd></div><div><dt>백채널 표현</dt><dd>표정·자세·시선·고개 움직임</dd></div><div><dt>제공 예시</dt><dd>대표 발표 맥락, 실제 또는 목업 애니메이션 클립, 반응 시점·강도·빈도 및 반응 에이전트 배분 예시</dd></div></dl><details className="theory-references"><summary>관련 이론 참고문헌 확인하기</summary><p>E·V·C는 본 연구에서 구성한 청중 상태 모델입니다. 아래 문헌은 상태 평가 과정과 동적인 반응 갱신에 관한 관련 이론적 배경을 확인하기 위한 자료입니다.</p><ul><li><a href="https://doi.org/10.1093/oso/9780195130072.003.0005" target="_blank" rel="noreferrer">Scherer (2001), Appraisal Considered as a Process of Multilevel Sequential Checking</a><span>Oxford University Press · DOI 원문 페이지</span></li><li><a href="https://doi.org/10.1080/02699930902928969" target="_blank" rel="noreferrer">Scherer (2009), The Dynamic Architecture of Emotion</a><span>Cognition and Emotion, 23(7), 1307–1351 · DOI 원문 페이지</span></li></ul></details></section>

    <section className="form-section evaluation-section" aria-labelledby="model-evaluation-title"><div className="legend-like"><span>06</span><div><b id="model-evaluation-title">E·V·C 청중 상태 모델 평가</b><small>각 문항을 4점 척도로 평가하고 필요한 경우 근거와 수정안을 작성해주세요.</small></div></div><div className="review-scale-note"><b>4점 척도</b><span data-score="1">1 전혀 적절하지 않음</span><span data-score="2">2 보완이 많이 필요함</span><span data-score="3">3 대체로 적절함</span><span data-score="4">4 매우 적절함</span><em>오해 위험: 1 매우 높음 · 2 높은 편 · 3 낮은 편 · 4 매우 낮음</em></div><ul className="evaluation-guidance"><li>판단하기 어렵거나 자신의 전문영역 밖인 경우 점수 대신 ‘판단 어려움/전문영역 외’를 선택해주세요.</li><li>중대 문제는 사용자 실험 전에 반드시 수정해야 한다고 판단되는 의미·맥락·구현 또는 윤리상의 문제를 의미합니다.</li><li>판단 근거·수정안은 보완이 필요하거나 중대 문제가 있다고 판단한 항목을 중심으로 작성해주세요.</li></ul><div className="criteria-list fixed-criteria">{modelCriteria.map((criterion, index) => { const answer = data.overall.model[criterion.key]; return <article className="criterion" key={criterion.key}><div className="criterion-copy"><span className="criterion-index">{String(index + 1).padStart(2, "0")}</span><div><b>{criterion.label}</b><p>{criterion.statement}</p></div></div><ScorePicker label={`${criterion.label} 점수`} value={answer.score} disabled={answer.unable} onChange={(score) => updateModel(criterion.key, { score, unable: false })} /><div className="criterion-flags"><label><input type="checkbox" checked={answer.unable} onChange={(event) => updateModel(criterion.key, { unable: event.target.checked, score: event.target.checked ? null : answer.score })} /> 판단 어려움/전문영역 외</label><label className="critical-check"><input type="checkbox" checked={answer.critical} onChange={(event) => updateModel(criterion.key, { critical: event.target.checked })} /> 중대 문제</label></div><label className="field criterion-note"><span>판단 근거·수정안</span><textarea rows={2} value={answer.comment} onChange={(event) => updateModel(criterion.key, { comment: event.target.value })} /></label></article>; })}</div><div className="model-summary"><div className="field"><span className="field-label">종합 권고</span><div className="choice-row">{["현행 유지", "일부 수정", "구조 수정", "추가 검토"].map((value) => <label key={value} className="choice-chip"><input type="radio" name="model-recommendation" checked={data.overall.modelRecommendation === value} onChange={() => setData((current) => ({ ...current, overall: { ...current.overall, modelRecommendation: value } }))} /><span>{value}</span></label>)}</div></div><div className="field"><span>판단 확신 · 1 낮음–4 높음</span><ScorePicker label="판단 확신" value={data.overall.confidence} onChange={(confidence) => setData((current) => ({ ...current, overall: { ...current.overall, confidence } }))} /></div><label className="field full"><span>핵심 수정안</span><textarea rows={3} value={data.overall.coreRevision} onChange={(event) => setData((current) => ({ ...current, overall: { ...current.overall, coreRevision: event.target.value } }))} /></label><label className="field full"><span>누락·중복 구성요소</span><textarea rows={3} value={data.overall.missingDuplicate} onChange={(event) => setData((current) => ({ ...current, overall: { ...current.overall, missingDuplicate: event.target.value } }))} /></label></div></section>

    <fieldset className="form-section framework-evaluation">
      <legend><span>07</span> 프레임워크 전체 평가</legend>
      <p className="section-help">실제 또는 목업 애니메이션 클립을 확인하면서 평가해주세요. 응답 기준은 6절의 4점 척도와 동일합니다.</p>
      <div className="framework-review-layout">
        <aside className="framework-video-column">
          <div className="video-player-sticky">
            <div className="video-tabs" role="group" aria-label="영상 샘플 선택">{(["A", "B"] as VideoKey[]).map((video) => <button key={video} type="button" className={activeVideo === video ? "active" : ""} aria-pressed={activeVideo === video} onClick={() => setActiveVideo(video)}>영상 {video}</button>)}</div>
            {videoAvailable[activeVideo] !== false ? <video key={activeVideo} controls playsInline preload="metadata" aria-label={`영상 샘플 ${activeVideo}`} onCanPlay={() => setVideoAvailable((current) => ({ ...current, [activeVideo]: true }))} onError={() => setVideoAvailable((current) => ({ ...current, [activeVideo]: false }))}><source src={`./videos/sample-${activeVideo.toLowerCase()}.mp4`} type="video/mp4" />이 브라우저에서는 영상을 재생할 수 없습니다.</video> : <div className="video-empty"><strong>영상 샘플 {activeVideo} 연결 대기</strong><p>영상 파일이 연결되면 이 자리에서 바로 재생할 수 있습니다.</p></div>}
            <div className="video-player-note"><span>대표 발표 맥락</span><span>AI 청중 반응</span><span>시점·강도·빈도·배분 확인</span></div>
          </div>
        </aside>
        <div className="overall-list">{frameworkItems.map((item, index) => { const answer = data.overall.framework[item.key]; return <article className="overall-item" key={item.key}><span className="overall-number">{String(index + 1).padStart(2, "0")}</span><div className="overall-copy"><b>{item.label}</b><p>{item.statement}</p></div><ScorePicker label={`${item.label} 점수`} value={answer.score} disabled={answer.unable} onChange={(score) => updateFramework(item.key, { score, unable: false })} /><label className="unable-check"><input type="checkbox" checked={answer.unable} onChange={(event) => updateFramework(item.key, { unable: event.target.checked, score: event.target.checked ? null : answer.score })} /> 판단 어려움/전문영역 외</label><label className="field full"><span>의견</span><textarea rows={2} value={answer.comment} onChange={(event) => updateFramework(item.key, { comment: event.target.value })} /></label></article>; })}</div>
      </div>
    </fieldset>
    <div className="export-panel"><div><p className="eyebrow light">FINAL SUBMISSION</p><h3>{data.submissionStatus === "submitted" ? "평가가 제출되었습니다." : "작성한 평가를 최종 제출해주세요."}</h3><p>참여자 ID <strong>{participantId}</strong>로 저장됩니다. 제출 후에도 같은 링크에서 내용을 수정해 다시 제출할 수 있습니다.</p></div><div className="export-actions"><button type="button" className="button primary" onClick={submitReview}>{data.submissionStatus === "submitted" ? "수정 내용 다시 제출" : "검토 완료 제출"} <span>→</span></button></div></div>
  </section>;
}
