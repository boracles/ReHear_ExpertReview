"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { firebaseAuth, firestore, googleAuthProvider } from "./firebase";
import { constructDefinitions, initialInterviewCodes, interviewQuestions, surveyItems } from "./user-study-data";

type Tab = "overview" | "quant" | "qual" | "evidence" | "export";
type StudyDoc = Record<string, any>;
type CodingDoc = Record<string, any> & { id: string };
type SummaryRow = { key: string; label: string; role: string; contingent: number[]; noncontingent: number[]; differences: number[] };

const RESEARCHER_EMAIL = "boracles@snu.ac.kr";

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function sd(values: number[]) { if (values.length < 2) return 0; const average = mean(values); return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1)); }
function fmt(value: number) { return Number.isFinite(value) && value ? value.toFixed(2) : "—"; }

function conditionScale(condition: any, ids: readonly string[], reverse: readonly string[] = []) {
  const values = ids.map((id) => Number(condition?.answers?.[id])).filter((value) => value >= 1 && value <= 7);
  if (values.length !== ids.length) return null;
  return mean(ids.map((id) => { const value = Number(condition.answers[id]); return reverse.includes(id) ? 8 - value : value; }));
}

function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

function DashboardLogo() { return <span className="dashboard-logo"><img src="./rehear-logo-white.svg" alt="" aria-hidden="true" /><b>Research Console</b></span>; }

export function ResearchDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("overview");
  const [expertDocs, setExpertDocs] = useState<StudyDoc[]>([]);
  const [studyDocs, setStudyDocs] = useState<StudyDoc[]>([]);
  const [codingDocs, setCodingDocs] = useState<CodingDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [codingForm, setCodingForm] = useState<Record<string, string>>({ participantId: "", questionNo: "1", conditionReference: "", transcriptExcerpt: "", relatedSystemLogId: "", relatedAgentResponseId: "", mappingRuleId: "", intendedMeaning: "", participantInterpretation: "", expertUserAlignment: "unclear", interpretationMatch: "unclear", initialCode: initialInterviewCodes[0], focusedCode: "", theme: "", rqLink: "", codingMemo: "" });

  useEffect(() => onAuthStateChanged(firebaseAuth, (next) => setUser(next)), []);

  async function loadData() {
    setLoading(true); setError("");
    try {
      const [experts, studies, coding] = await Promise.all([
        getDocs(collection(firestore, "expertReviewResponses")),
        getDocs(collection(firestore, "userStudyResponses")),
        getDocs(query(collection(firestore, "qualitativeCoding"), orderBy("createdAt", "desc"))),
      ]);
      setExpertDocs(experts.docs.map((item) => ({ id: item.id, ...item.data() })));
      setStudyDocs(studies.docs.map((item) => ({ id: item.id, ...item.data() })));
      setCodingDocs(coding.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user?.email === RESEARCHER_EMAIL) loadData(); }, [user]);

  const summaries = useMemo<SummaryRow[]>(() => constructDefinitions.map((definition) => {
    const row: SummaryRow = { key: definition.key, label: definition.label, role: definition.role, contingent: [], noncontingent: [], differences: [] };
    studyDocs.forEach((document) => {
      const contingent = document.conditions?.find((condition: any) => condition.conditionType === "contingent");
      const noncontingent = document.conditions?.find((condition: any) => condition.conditionType === "noncontingent");
      const a = conditionScale(contingent, definition.ids, "reverse" in definition ? definition.reverse : []);
      const b = conditionScale(noncontingent, definition.ids, "reverse" in definition ? definition.reverse : []);
      if (a !== null) row.contingent.push(a);
      if (b !== null) row.noncontingent.push(b);
      if (a !== null && b !== null) row.differences.push(a - b);
    });
    return row;
  }), [studyDocs]);

  const submittedExperts = expertDocs.filter((document) => document.submissionStatus === "submitted").length;
  const submittedUsers = studyDocs.filter((document) => document.submissionStatus === "submitted").length;

  async function saveCoding() {
    if (!codingForm.participantId || !codingForm.transcriptExcerpt.trim()) { window.alert("참여자 ID와 전사 발췌문을 입력해주세요."); return; }
    try {
      await addDoc(collection(firestore, "qualitativeCoding"), { ...codingForm, analystId: user?.email, createdAt: serverTimestamp(), updatedAt: new Date().toISOString() });
      setCodingForm((current) => ({ ...current, transcriptExcerpt: "", participantInterpretation: "", codingMemo: "" }));
      await loadData();
    } catch { window.alert("코딩 기록을 저장하지 못했습니다. Firestore 규칙을 확인해주세요."); }
  }

  function exportUserCsv() {
    const header = ["participant_id", "condition_seq", "condition_type", "subtopic_id", "framework_version", "system_build_version", "video_sample_version", ...surveyItems.map((item) => item.id), "response_complete"];
    const rows = studyDocs.flatMap((document) => (document.conditions || []).map((condition: any) => [document.participantId, condition.conditionSeq, condition.conditionType, condition.subtopicId, document.frameworkVersion, document.systemBuildVersion, document.videoSampleVersion, ...surveyItems.map((item) => condition.answers?.[item.id] ?? ""), Boolean(condition.completedAt)]));
    download("rehear_user_condition_responses.csv", [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"));
  }

  function exportCodingCsv() {
    const header = ["excerpt_id", "participant_id", "question_no", "condition_reference", "transcript_excerpt", "related_system_log_id", "related_agent_response_id", "mapping_rule_id", "intended_meaning", "participant_interpretation", "expert_user_alignment", "interpretation_match", "initial_code", "focused_code", "theme", "rq_link", "analyst_id", "coding_memo"];
    const rows = codingDocs.map((item) => [item.id, item.participantId, item.questionNo, item.conditionReference, item.transcriptExcerpt, item.relatedSystemLogId, item.relatedAgentResponseId, item.mappingRuleId, item.intendedMeaning, item.participantInterpretation, item.expertUserAlignment, item.interpretationMatch, item.initialCode, item.focusedCode, item.theme, item.rqLink, item.analystId, item.codingMemo]);
    download("rehear_qualitative_coding.csv", [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"));
  }

  if (user === undefined) return <main className="dashboard-gate">연구자 인증 상태를 확인하고 있습니다.</main>;
  if (!user || user.email !== RESEARCHER_EMAIL) return <main className="dashboard-gate"><section><DashboardLogo /><p className="eyebrow">PRIVATE RESEARCH WORKSPACE</p><h1>연구자 분석 대시보드</h1><p>전문가 검토와 사용자 실험 데이터를 한곳에서 정리하고 분석합니다.</p>{user && <p className="auth-error">{user.email} 계정에는 접근 권한이 없습니다.</p>}<button onClick={() => signInWithPopup(firebaseAuth, googleAuthProvider)}>서울대학교 Google 계정으로 로그인</button><small>허용 계정 · {RESEARCHER_EMAIL}</small></section></main>;

  const nav: Array<[Tab, string]> = [["overview", "연구 현황"], ["quant", "정량 분석"], ["qual", "면담·질적 코딩"], ["evidence", "통합 증거"], ["export", "내보내기"]];
  return <main className="research-dashboard">
    <header><DashboardLogo /><nav>{nav.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav><div><span>{user.email}</span><button onClick={() => signOut(firebaseAuth)}>로그아웃</button></div></header>
    <section className="dashboard-title"><div><p className="eyebrow light">E·V·C RESEARCH DATA SYSTEM</p><h1>{nav.find(([key]) => key === tab)?.[1]}</h1><p>전문가 의도와 사용자 해석, 조건별 응답과 면담 근거를 연결합니다.</p></div><button onClick={loadData} disabled={loading}>{loading ? "불러오는 중" : "데이터 새로고침"}</button></section>
    {error && <div className="dashboard-error"><b>데이터 연결 확인 필요</b><span>{error}</span></div>}

    {tab === "overview" && <section className="dashboard-content"><div className="metric-grid"><article><span>전문가 제출</span><strong>{submittedExperts}</strong><small>전체 저장 {expertDocs.length}건</small></article><article><span>사용자 완료</span><strong>{submittedUsers}</strong><small>전체 저장 {studyDocs.length}명</small></article><article><span>조건 응답</span><strong>{studyDocs.reduce((sum, item) => sum + (item.conditions || []).filter((condition: any) => condition.completedAt).length, 0)}</strong><small>목표: 참여자당 2건</small></article><article><span>질적 발췌문</span><strong>{codingDocs.length}</strong><small>전문가·사용자 통합 코딩</small></article></div><div className="dashboard-panel"><h2>분석 준비 상태</h2><div className="readiness-list"><span><b>01</b> 전문가 평가 응답과 서면 의견</span><span><b>02</b> 사용자 조건별 7점 척도 응답</span><span><b>03</b> 사용자 면담 전사·사건 로그 연결</span><span><b>04</b> 전문가 의도–사용자 해석 일치 매트릭스</span></div></div></section>}

    {tab === "quant" && <section className="dashboard-content"><div className="dashboard-note"><b>분석 원칙</b><p>조건 효과의 최종 검정은 선형혼합모형(조건 고정효과, 참여자 랜덤 절편)을 사용하고, 기간·순서·장소를 통제하거나 민감도 분석에 포함하세요. 아래 값은 데이터 점검용 기술통계와 대응 차이입니다.</p></div><div className="stat-table"><div className="stat-head"><span>척도</span><span>연동 조건 M (SD)</span><span>비연동 조건 M (SD)</span><span>대응 차이 [95% CI]</span><span>Cohen’s dz</span></div>{summaries.map((row) => { const difference = mean(row.differences); const se = row.differences.length ? sd(row.differences) / Math.sqrt(row.differences.length) : 0; const dz = sd(row.differences) ? difference / sd(row.differences) : 0; return <div key={row.key}><span><b>{row.label}</b><small>{row.role} · n={row.differences.length}</small></span><span>{fmt(mean(row.contingent))} ({fmt(sd(row.contingent))})</span><span>{fmt(mean(row.noncontingent))} ({fmt(sd(row.noncontingent))})</span><span>{fmt(difference)} [{fmt(difference - 1.96 * se)}, {fmt(difference + 1.96 * se)}]</span><span>{fmt(dz)}</span></div>; })}</div><div className="dashboard-note"><b>사전 분석 연결</b><p>H1: 수행–반응 연동성 조작 점검 · H2: 지각된 반응성 단일 주요 결과 · H3a–c: 상호작용 가능성, 공동현존감, 관찰·평가 지각에 Holm 보정 · 경험 품질 5문항은 탐색적으로 효과크기와 95% 신뢰구간을 보고합니다.</p></div></section>}

    {tab === "qual" && <section className="dashboard-content qual-layout"><div className="dashboard-panel coding-form"><div><h2>사용자 면담 발췌문 코딩</h2><p>면담 질문은 참여자 설문이 아니라 연구자가 전사 후 이 화면에서 기록합니다.</p></div><div className="coding-grid"><label><span>참여자 ID</span><input value={codingForm.participantId} onChange={(e) => setCodingForm({ ...codingForm, participantId: e.target.value })} placeholder="예: USR-001" /></label><label><span>면담 질문</span><select value={codingForm.questionNo} onChange={(e) => setCodingForm({ ...codingForm, questionNo: e.target.value })}>{interviewQuestions.map((question, index) => <option key={question} value={index + 1}>{index + 1}. {question}</option>)}</select></label><label><span>조건 참조</span><select value={codingForm.conditionReference} onChange={(e) => setCodingForm({ ...codingForm, conditionReference: e.target.value })}><option value="">선택</option><option>첫 번째 조건</option><option>두 번째 조건</option><option>조건 비교</option><option>전체 경험</option></select></label><label><span>초기 코드</span><select value={codingForm.initialCode} onChange={(e) => setCodingForm({ ...codingForm, initialCode: e.target.value })}>{initialInterviewCodes.map((code) => <option key={code}>{code}</option>)}</select></label><label className="full"><span>전사 발췌문</span><textarea rows={5} value={codingForm.transcriptExcerpt} onChange={(e) => setCodingForm({ ...codingForm, transcriptExcerpt: e.target.value })} /></label><label><span>관련 시스템 로그 ID</span><input value={codingForm.relatedSystemLogId} onChange={(e) => setCodingForm({ ...codingForm, relatedSystemLogId: e.target.value })} /></label><label><span>관련 에이전트 반응 ID</span><input value={codingForm.relatedAgentResponseId} onChange={(e) => setCodingForm({ ...codingForm, relatedAgentResponseId: e.target.value })} /></label><label><span>전문가가 의도한 의미</span><input value={codingForm.intendedMeaning} onChange={(e) => setCodingForm({ ...codingForm, intendedMeaning: e.target.value })} /></label><label><span>사용자 해석</span><input value={codingForm.participantInterpretation} onChange={(e) => setCodingForm({ ...codingForm, participantInterpretation: e.target.value })} /></label><label><span>전문가–사용자 정렬</span><select value={codingForm.expertUserAlignment} onChange={(e) => setCodingForm({ ...codingForm, expertUserAlignment: e.target.value })}><option value="match">일치</option><option value="partial">부분 일치</option><option value="mismatch">불일치</option><option value="unclear">판단 불명확</option></select></label><label><span>집중 코드 / 주제</span><input value={codingForm.focusedCode} onChange={(e) => setCodingForm({ ...codingForm, focusedCode: e.target.value })} placeholder="예: 반응 시점 불일치" /></label><label className="full"><span>코딩 메모·반례·경계조건</span><textarea rows={3} value={codingForm.codingMemo} onChange={(e) => setCodingForm({ ...codingForm, codingMemo: e.target.value })} /></label></div><button className="dashboard-primary" onClick={saveCoding}>코딩 기록 저장</button></div><div className="dashboard-panel coding-list"><h2>저장된 코딩 기록</h2>{codingDocs.length ? codingDocs.map((item) => <article key={item.id}><div><span>{item.participantId}</span><b>Q{item.questionNo} · {item.initialCode}</b><em data-alignment={item.expertUserAlignment}>{item.expertUserAlignment === "match" ? "일치" : item.expertUserAlignment === "partial" ? "부분 일치" : item.expertUserAlignment === "mismatch" ? "불일치" : "판단 불명확"}</em></div><p>{item.transcriptExcerpt}</p><small>{item.codingMemo}</small></article>) : <p className="empty-state">아직 저장된 코딩 기록이 없습니다.</p>}</div></section>}

    {tab === "evidence" && <section className="dashboard-content"><div className="dashboard-note"><b>통합 판단 기준</b><p>전문가 검토, 사용자 정량 응답, 사용자 면담, 시스템 로그 중 둘 이상의 근거가 수렴할 때 설계 원칙으로 승격합니다. 불일치와 반례는 삭제하지 않고 경계조건으로 기록합니다.</p></div><div className="evidence-grid"><article><span>EXPERT</span><h3>전문가 의도·구현 판단</h3><p>모델 평가, 영상 구간 평가, 전체 평가, 서면 의견과 면담 코드를 연결합니다.</p></article><article><span>USER QUANT</span><h3>조건별 사용자 경험</h3><p>지각된 반응성과 상호작용, 공동현존감, 평가 지각의 조건 차이를 확인합니다.</p></article><article><span>USER QUAL</span><h3>사용자 의미 해석</h3><p>전문가가 의도한 의미와 실제 사용자의 해석을 일치·부분 일치·불일치로 코딩합니다.</p></article><article><span>SYSTEM LOG</span><h3>실제 발생 사건</h3><p>발표 수행정보, 매핑 규칙, 에이전트 반응 ID와 면담 발췌문을 사건 단위로 연결합니다.</p></article></div></section>}

    {tab === "export" && <section className="dashboard-content"><div className="export-grid"><article><span>01</span><h2>사용자 조건별 응답 CSV</h2><p>참여자×조건의 long-format 데이터로, q01–q22와 자동 기록된 버전을 포함합니다.</p><button onClick={exportUserCsv}>CSV 내려받기</button></article><article><span>02</span><h2>질적 코딩 CSV</h2><p>발췌문, 사건 로그, 의도–해석 정렬, 코드와 메모를 분석 가능한 형식으로 내보냅니다.</p><button onClick={exportCodingCsv}>CSV 내려받기</button></article><article><span>03</span><h2>전체 원본 JSON</h2><p>전문가·사용자·코딩 데이터를 백업하거나 다른 분석 도구로 옮길 때 사용합니다.</p><button onClick={() => download("rehear_research_backup.json", JSON.stringify({ exportedAt: new Date().toISOString(), expertDocs, studyDocs, codingDocs }, null, 2), "application/json")}>JSON 백업</button></article></div></section>}
  </main>;
}
