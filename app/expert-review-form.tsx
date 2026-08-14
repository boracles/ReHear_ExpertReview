"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";

type Score = 1 | 2 | 3 | 4 | null;

type Criterion = {
  key: string;
  label: string;
  statement: string;
};

type RuleEvaluation = {
  id: string;
  ruleId: string;
  frameworkVersion: string;
  performanceInfo: string;
  intendedMeaning: string;
  backchannelForm: string;
  triggerRule: string;
  intensityFrequency: string;
  exampleScene: string;
  exceptionCondition: string;
  scores: Record<string, Score>;
  notes: Record<string, string>;
  critical: Record<string, boolean>;
  recommendation: string;
  confidence: Score;
  coreRevision: string;
  missingDuplicate: string;
};

type ReviewData = {
  schemaVersion: "1.1";
  participantId: string;
  updatedAt: string;
  submissionStatus: "draft" | "submitted";
  submittedAt: string | null;
  expert: {
    expertise: string[];
    careerYears: string;
    affiliationType: string;
    conflict: string;
    conflictDetails: string;
  };
  session: {
    reviewDate: string;
    interviewMode: string;
    recording: string;
    frameworkVersion: string;
    ruleSetVersion: string;
  };
  ruleEvaluations: RuleEvaluation[];
  overall: Record<string, { score: Score; comment: string }>;
};

const criteria: Criterion[] = [
  { key: "content", label: "내용 적절성", statement: "수행 정보와 평가 의미가 이론·실무적으로 관련되어 있다." },
  { key: "clarity", label: "의미 명확성", statement: "백채널이 의도한 관심·이해·동의·혼란·지루함·평가 의미를 비교적 명확히 전달한다." },
  { key: "context", label: "맥락 적합성", statement: "발표 구간과 실제 발표 맥락에서 이 반응이 자연스럽고 납득 가능하다." },
  { key: "timing", label: "시점 적절성", statement: "탐지 후 지연, 발생 구간 및 쿨다운이 사회적 반응으로 적절하다." },
  { key: "intensity", label: "강도·빈도 적절성", statement: "반응 강도, 반복 빈도 및 반응 에이전트 수가 과도하거나 부족하지 않다." },
  { key: "feasibility", label: "구현 가능성", statement: "정의된 입력과 시스템 제약 안에서 일관되게 구현·재현할 수 있다." },
  { key: "misreadRisk", label: "오해 위험", statement: "의도와 다른 의미로 해석되거나 부당한 평가로 느껴질 위험이 있다. 이 항목만 높을수록 위험합니다." },
];

const overallItems = [
  "발표 수행 정보가 중요한 내용·전달 차원을 충분히 포함한다.",
  "평가 차원과 백채널 유형 사이의 구분이 명확하며 중복이 과도하지 않다.",
  "반응의 시점·강도·빈도·에이전트 분배 원칙이 일관된다.",
  "긍정·중립·비판적 반응의 범위가 발표 훈련 목적에 적절하다.",
  "오탐·불확실성·상충 신호가 발생했을 때의 예외 규칙이 충분하다.",
  "프레임워크를 실제 VR 발표 훈련 시스템에 구현하고 설명할 수 있다.",
];

function newRule(index: number): RuleEvaluation {
  return {
    id: `rule-${Date.now()}-${index}`,
    ruleId: "",
    frameworkVersion: "",
    performanceInfo: "",
    intendedMeaning: "",
    backchannelForm: "",
    triggerRule: "",
    intensityFrequency: "",
    exampleScene: "",
    exceptionCondition: "",
    scores: Object.fromEntries(criteria.map((item) => [item.key, null])),
    notes: Object.fromEntries(criteria.map((item) => [item.key, ""])),
    critical: Object.fromEntries(criteria.map((item) => [item.key, false])),
    recommendation: "",
    confidence: null,
    coreRevision: "",
    missingDuplicate: "",
  };
}

function initialData(participantId: string): ReviewData {
  return {
    schemaVersion: "1.1",
    participantId,
    updatedAt: new Date().toISOString(),
    submissionStatus: "draft",
    submittedAt: null,
    expert: { expertise: [], careerYears: "", affiliationType: "", conflict: "", conflictDetails: "" },
    session: { reviewDate: "", interviewMode: "", recording: "", frameworkVersion: "", ruleSetVersion: "" },
    ruleEvaluations: [newRule(0)],
    overall: Object.fromEntries(overallItems.map((_, index) => [`item${index + 1}`, { score: null, comment: "" }])),
  };
}

function normalizeReviewData(value: unknown, participantId: string): ReviewData | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<ReviewData>;
  if (parsed.participantId !== participantId) return null;
  return {
    ...initialData(participantId),
    ...parsed,
    schemaVersion: "1.1",
    participantId,
    submissionStatus: parsed.submissionStatus === "submitted" ? "submitted" : "draft",
    submittedAt: typeof parsed.submittedAt === "string" ? parsed.submittedAt : null,
  };
}

function ScorePicker({ value, onChange, label }: { value: Score; onChange: (score: Score) => void; label: string }) {
  return (
    <div className="score-picker" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4].map((score) => (
        <button
          key={score}
          type="button"
          role="radio"
          aria-checked={value === score}
          className={value === score ? "selected" : ""}
          onClick={() => onChange(score as Score)}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function ExpertReviewForm({ participantId, reviewToken }: { participantId: string; reviewToken: string }) {
  const storageKey = `rehear-review-${participantId}`;
  const [data, setData] = useState<ReviewData>(() => initialData(participantId));
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [syncStatus, setSyncStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function restoreDraft() {
      let restoredData = initialData(participantId);
      const stored = window.localStorage.getItem(storageKey);
      try {
        if (stored) {
          const localData = normalizeReviewData(JSON.parse(stored), participantId);
          if (localData) restoredData = localData;
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }

      try {
        const snapshot = await getDoc(doc(firestore, "expertReviewResponses", reviewToken));
        const serverData = snapshot.exists() ? normalizeReviewData(snapshot.data(), participantId) : null;
        if (serverData && new Date(serverData.updatedAt).getTime() >= new Date(restoredData.updatedAt).getTime()) {
          restoredData = serverData;
        }
        if (active) setSyncStatus(snapshot.exists() ? "saved" : "ready");
      } catch {
        if (active) setSyncStatus("error");
      }

      if (active) {
        setData(restoredData);
        setRestored(true);
      }
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
      setDoc(
        doc(firestore, "expertReviewResponses", reviewToken),
        { ...next, serverUpdatedAt: serverTimestamp() },
        { merge: true },
      ).then(() => {
        setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
        setSyncStatus("saved");
      }).catch(() => {
        setSyncStatus("error");
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [data, restored, reviewToken, storageKey]);

  const syncLabel = syncStatus === "loading" ? "저장된 초안 확인 중"
    : syncStatus === "saving" ? "자동 저장 중"
    : syncStatus === "saved" ? `${savedAt || "현재"} 자동 저장됨`
    : syncStatus === "error" ? "임시 저장됨 · 연결 시 다시 저장"
    : "자동 저장 준비 완료";

  const completion = useMemo(() => {
    const ruleScores = data.ruleEvaluations.flatMap((rule) => Object.values(rule.scores));
    const overallScores = Object.values(data.overall).map((item) => item.score);
    const values = [...ruleScores, ...overallScores];
    const completed = values.filter(Boolean).length;
    return values.length ? Math.round((completed / values.length) * 100) : 0;
  }, [data]);

  function updateExpert<K extends keyof ReviewData["expert"]>(key: K, value: ReviewData["expert"][K]) {
    setData((current) => ({ ...current, expert: { ...current.expert, [key]: value } }));
  }

  function updateSession<K extends keyof ReviewData["session"]>(key: K, value: ReviewData["session"][K]) {
    setData((current) => ({ ...current, session: { ...current.session, [key]: value } }));
  }

  function updateRule(index: number, patch: Partial<RuleEvaluation>) {
    setData((current) => ({
      ...current,
      ruleEvaluations: current.ruleEvaluations.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
    }));
  }

  function exportJson() {
    const finalized = { ...data, updatedAt: new Date().toISOString() };
    downloadText(`ReHear_${participantId}_review.json`, JSON.stringify(finalized, null, 2), "application/json;charset=utf-8");
  }

  function exportCsv() {
    const flattened: Record<string, unknown> = {
      participant_id: participantId,
      updated_at: new Date().toISOString(),
      submission_status: data.submissionStatus,
      submitted_at: data.submittedAt,
      expertise: data.expert.expertise.join("; "),
      career_years: data.expert.careerYears,
      affiliation_type: data.expert.affiliationType,
      conflict: data.expert.conflict,
      conflict_details: data.expert.conflictDetails,
      review_date: data.session.reviewDate,
      interview_mode: data.session.interviewMode,
      recording: data.session.recording,
      framework_version: data.session.frameworkVersion,
      rule_set_version: data.session.ruleSetVersion,
      rule_evaluations_json: data.ruleEvaluations,
    };
    overallItems.forEach((_, index) => {
      const item = data.overall[`item${index + 1}`];
      flattened[`overall_${index + 1}_score`] = item.score;
      flattened[`overall_${index + 1}_comment`] = item.comment;
    });
    const headers = Object.keys(flattened);
    const csv = `\uFEFF${headers.map(csvEscape).join(",")}\r\n${headers.map((key) => csvEscape(flattened[key])).join(",")}\r\n`;
    downloadText(`ReHear_${participantId}_review.csv`, csv, "text/csv;charset=utf-8");
  }

  async function submitReview() {
    if (!window.confirm("작성한 평가를 최종 제출할까요? 제출 후에도 같은 링크에서 내용을 수정하고 다시 제출할 수 있습니다.")) return;
    const submittedAt = new Date().toISOString();
    const finalized: ReviewData = {
      ...data,
      updatedAt: submittedAt,
      submissionStatus: "submitted",
      submittedAt,
    };
    setData(finalized);
    window.localStorage.setItem(storageKey, JSON.stringify(finalized));
    setSyncStatus("saving");
    try {
      await setDoc(
        doc(firestore, "expertReviewResponses", reviewToken),
        { ...finalized, serverUpdatedAt: serverTimestamp() },
        { merge: true },
      );
      setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
      setSyncStatus("saved");
      window.alert("평가가 안전하게 제출되었습니다.");
    } catch {
      setSyncStatus("error");
      window.alert("기기에는 저장되었지만 서버 제출에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 눌러주세요.");
    }
  }

  return (
    <section className="review-workspace" id="review-workspace" aria-labelledby="review-title">
      <div className="review-topline">
        <div>
          <p className="eyebrow">STRUCTURED EXPERT REVIEW</p>
          <h2 id="review-title">전문가 검토 평가표</h2>
          <p>작성 내용은 자동으로 임시 저장됩니다.<br />작성을 마치면 아래의 최종 제출 버튼을 눌러주세요.</p>
        </div>
        <div className="progress-card">
          <span>평가 점수 입력률</span>
          <strong>{completion}%</strong>
          <div><i style={{ width: `${completion}%` }} /></div>
          <small>{syncLabel}</small>
        </div>
      </div>

      <section className="form-section compact-section" aria-labelledby="expert-info-title">
        <div className="legend-like">
          <span>01</span>
          <div><b id="expert-info-title">검토자 정보</b><small>전문 분야와 관련 경력을 확인합니다.</small></div>
        </div>
        <div className="form-grid two">
          <div className="field full">
            <span className="field-label">관련 전문영역 · 복수 선택 가능</span>
            <div className="choice-row">
              {["발표·커뮤니케이션", "HCI·Human–AI Interaction", "XR 인터랙션·가상 에이전트"].map((value) => (
                <label key={value} className="choice-chip">
                  <input type="checkbox" checked={data.expert.expertise.includes(value)} onChange={(event) => {
                    const expertise = event.target.checked ? [...data.expert.expertise, value] : data.expert.expertise.filter((item) => item !== value);
                    updateExpert("expertise", expertise);
                  }} />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="field"><span>관련 경력</span><input inputMode="decimal" value={data.expert.careerYears} onChange={(e) => updateExpert("careerYears", e.target.value)} placeholder="예: 10년" /></label>
          <label className="field"><span>소속 유형</span><select value={data.expert.affiliationType} onChange={(e) => updateExpert("affiliationType", e.target.value)}><option value="">선택</option><option>대학</option><option>연구기관</option><option>산업체</option><option>기타</option></select></label>
          <label className="field"><span>이해상충 여부</span><select value={data.expert.conflict} onChange={(e) => updateExpert("conflict", e.target.value)}><option value="">선택</option><option>없음</option><option>있음</option></select></label>
          {data.expert.conflict === "있음" && <label className="field full"><span>이해관계 내용</span><textarea rows={3} value={data.expert.conflictDetails} onChange={(e) => updateExpert("conflictDetails", e.target.value)} /></label>}
        </div>
      </section>

      <section className="form-section compact-section" aria-labelledby="review-info-title">
        <div className="legend-like">
          <span>02</span>
          <div><b id="review-info-title">평가 정보</b><small>평가일과 검토한 자료의 버전을 기록합니다.</small></div>
        </div>
        <div className="form-grid three">
          <label className="field"><span>검토일</span><input type="date" value={data.session.reviewDate} onChange={(e) => updateSession("reviewDate", e.target.value)} /></label>
          <label className="field"><span>프레임워크 버전</span><input value={data.session.frameworkVersion} onChange={(e) => updateSession("frameworkVersion", e.target.value)} placeholder="예: V1" /></label>
          <label className="field"><span>규칙 세트 버전</span><input value={data.session.ruleSetVersion} onChange={(e) => updateSession("ruleSetVersion", e.target.value)} placeholder="예: R1" /></label>
        </div>
      </section>

      <div className="form-section rule-section">
        <div className="legend-like"><span>03</span><div><b>규칙별 평가</b><small>검토할 규칙마다 카드 한 장을 작성합니다.</small></div></div>
        <div className="review-scale-note">
          <b>4점 척도 안내</b>
          <span>1 전혀 적절하지 않음</span><span>2 보완이 많이 필요함</span><span>3 대체로 적절함</span><span>4 매우 적절함</span>
          <em>‘오해 위험’만 1 매우 낮음–4 매우 높음</em>
        </div>
        {data.ruleEvaluations.map((rule, ruleIndex) => (
          <article className="rule-form" key={rule.id}>
            <div className="rule-form-head">
              <div><span>RULE CARD</span><h3>규칙 평가 {String(ruleIndex + 1).padStart(2, "0")}</h3></div>
              {data.ruleEvaluations.length > 1 && <button type="button" onClick={() => setData((current) => ({ ...current, ruleEvaluations: current.ruleEvaluations.filter((_, index) => index !== ruleIndex) }))}>이 카드 삭제</button>}
            </div>
            <div className="form-grid two compact">
              <label className="field"><span>규칙 ID</span><input value={rule.ruleId} onChange={(e) => updateRule(ruleIndex, { ruleId: e.target.value })} /></label>
              <label className="field"><span>프레임워크 버전</span><input value={rule.frameworkVersion} onChange={(e) => updateRule(ruleIndex, { frameworkVersion: e.target.value })} /></label>
              <label className="field full"><span>발표 수행 정보</span><textarea rows={2} value={rule.performanceInfo} onChange={(e) => updateRule(ruleIndex, { performanceInfo: e.target.value })} placeholder="예: 근거 부족, 설명 구조, 말하기 속도, 휴지, 음량, 머리 방향" /></label>
              <label className="field full"><span>평가 차원·의도</span><textarea rows={2} value={rule.intendedMeaning} onChange={(e) => updateRule(ruleIndex, { intendedMeaning: e.target.value })} /></label>
              <label className="field"><span>백채널 형태</span><textarea rows={2} value={rule.backchannelForm} onChange={(e) => updateRule(ruleIndex, { backchannelForm: e.target.value })} /></label>
              <label className="field"><span>발생 규칙</span><textarea rows={2} value={rule.triggerRule} onChange={(e) => updateRule(ruleIndex, { triggerRule: e.target.value })} /></label>
              <label className="field"><span>강도·빈도</span><textarea rows={2} value={rule.intensityFrequency} onChange={(e) => updateRule(ruleIndex, { intensityFrequency: e.target.value })} /></label>
              <label className="field"><span>예시 장면</span><textarea rows={2} value={rule.exampleScene} onChange={(e) => updateRule(ruleIndex, { exampleScene: e.target.value })} /></label>
              <label className="field full"><span>실패·예외 조건</span><textarea rows={2} value={rule.exceptionCondition} onChange={(e) => updateRule(ruleIndex, { exceptionCondition: e.target.value })} /></label>
            </div>
            <div className="criteria-list">
              {criteria.map((criterion) => (
                <div className="criterion" key={criterion.key}>
                  <div className="criterion-copy"><b>{criterion.label}</b><p>{criterion.statement}</p></div>
                  <ScorePicker label={`${criterion.label} 점수`} value={rule.scores[criterion.key]} onChange={(score) => updateRule(ruleIndex, { scores: { ...rule.scores, [criterion.key]: score } })} />
                  <label className="critical-check"><input type="checkbox" checked={rule.critical[criterion.key]} onChange={(e) => updateRule(ruleIndex, { critical: { ...rule.critical, [criterion.key]: e.target.checked } })} /> 중대 문제</label>
                  <label className="field criterion-note"><span>판단 근거·수정안</span><textarea rows={2} value={rule.notes[criterion.key]} onChange={(e) => updateRule(ruleIndex, { notes: { ...rule.notes, [criterion.key]: e.target.value } })} /></label>
                </div>
              ))}
            </div>
            <div className="rule-decision">
              <label className="field"><span>권고 결정</span><select value={rule.recommendation} onChange={(e) => updateRule(ruleIndex, { recommendation: e.target.value })}><option value="">선택</option><option>유지</option><option>수정</option><option>삭제·대체</option><option>추가 검토</option></select></label>
              <div className="field"><span>판단 확신 · 1 낮음–4 높음</span><ScorePicker label="판단 확신" value={rule.confidence} onChange={(confidence) => updateRule(ruleIndex, { confidence })} /></div>
              <label className="field full"><span>핵심 수정안</span><textarea rows={3} value={rule.coreRevision} onChange={(e) => updateRule(ruleIndex, { coreRevision: e.target.value })} /></label>
              <label className="field full"><span>누락·중복 규칙</span><textarea rows={3} value={rule.missingDuplicate} onChange={(e) => updateRule(ruleIndex, { missingDuplicate: e.target.value })} /></label>
            </div>
          </article>
        ))}
        <button className="add-rule" type="button" onClick={() => setData((current) => ({ ...current, ruleEvaluations: [...current.ruleEvaluations, newRule(current.ruleEvaluations.length)] }))}>+ 규칙 평가 카드 추가</button>
      </div>

      <fieldset className="form-section">
        <legend><span>04</span> 프레임워크 전체 평가</legend>
        <div className="overall-list">
          {overallItems.map((item, index) => {
            const key = `item${index + 1}`;
            const value = data.overall[key];
            return <div className="overall-item" key={key}>
              <span className="overall-number">{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
              <ScorePicker label={`전체 평가 ${index + 1}`} value={value.score} onChange={(score) => setData((current) => ({ ...current, overall: { ...current.overall, [key]: { ...value, score } } }))} />
              <label className="field full"><span>의견</span><textarea rows={2} value={value.comment} onChange={(e) => setData((current) => ({ ...current, overall: { ...current.overall, [key]: { ...value, comment: e.target.value } } }))} /></label>
            </div>;
          })}
        </div>
      </fieldset>

      <div className="export-panel">
        <div>
          <p className="eyebrow light">SAVE & HAND OFF</p>
          <h3>{data.submissionStatus === "submitted" ? "평가가 제출되었습니다." : "작성한 평가를 최종 제출해주세요."}</h3>
          <p>참여자 ID <strong>{participantId}</strong>로 저장됩니다. 필요할 경우 같은 내용을 JSON과 CSV 파일로도 내려받을 수 있습니다.</p>
        </div>
        <div className="export-actions">
          <button type="button" className="button primary" onClick={submitReview}>{data.submissionStatus === "submitted" ? "수정 내용 다시 제출" : "검토 완료 제출"} <span>→</span></button>
          <button type="button" className="button ghost" onClick={exportJson}>JSON 내려받기 <span>↓</span></button>
          <button type="button" className="button ghost" onClick={exportCsv}>CSV 내려받기 <span>↓</span></button>
        </div>
      </div>
    </section>
  );
}
