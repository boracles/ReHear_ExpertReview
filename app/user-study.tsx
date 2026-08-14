"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";
import {
  FRAMEWORK_VERSION,
  STUDY_TOKEN_HASHES,
  USER_STUDY_VERSION,
  VIDEO_SAMPLE_VERSION,
  surveyItems,
  type StudyProfile,
} from "./user-study-data";

type ConditionResponse = {
  conditionSeq: 1 | 2;
  conditionType: "contingent" | "noncontingent";
  subtopicId: string;
  startedAt: string;
  completedAt: string | null;
  answers: Record<string, number | null>;
};

type UserStudyData = {
  schemaVersion: "1.0";
  surveyVersion: string;
  participantId: string;
  conditionOrder: "AB" | "BA";
  frameworkVersion: string;
  systemBuildVersion: string;
  videoSampleVersion: string;
  updatedAt: string;
  submissionStatus: "draft" | "condition1_submitted" | "submitted";
  conditions: [ConditionResponse, ConditionResponse];
};

const SYSTEM_BUILD_VERSION = "2026-08-15";

function emptyAnswers() {
  return Object.fromEntries(surveyItems.map((item) => [item.id, null])) as Record<string, number | null>;
}

function initialData(profile: StudyProfile): UserStudyData {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    surveyVersion: USER_STUDY_VERSION,
    participantId: profile.participantId,
    conditionOrder: profile.conditionOrder,
    frameworkVersion: FRAMEWORK_VERSION,
    systemBuildVersion: SYSTEM_BUILD_VERSION,
    videoSampleVersion: VIDEO_SAMPLE_VERSION,
    updatedAt: now,
    submissionStatus: "draft",
    conditions: [
      { conditionSeq: 1, conditionType: profile.conditions[0], subtopicId: profile.subtopics[0], startedAt: now, completedAt: null, answers: emptyAnswers() },
      { conditionSeq: 2, conditionType: profile.conditions[1], subtopicId: profile.subtopics[1], startedAt: "", completedAt: null, answers: emptyAnswers() },
    ],
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function StudyLogo() {
  return <span
    className="study-logo"
    aria-label="Re:hear"
    style={{ WebkitMaskImage: 'url("./rehear-logo-white.svg")', maskImage: 'url("./rehear-logo-white.svg")' }}
  ><img src="./rehear-logo-white.svg" alt="" aria-hidden="true" /></span>;
}

function InvalidStudyLink() {
  return <main className="study-gate"><section><StudyLogo /><p className="eyebrow">RE:HEAR · USER STUDY</p><h1>사용자 실험 링크를<br />확인해주세요.</h1><p>연구자가 전달한 개인 링크를 다시 열거나 연구책임자에게 새 링크를 요청해주세요.</p><a href="mailto:boracles@snu.ac.kr">boracles@snu.ac.kr</a></section></main>;
}

export function UserStudy({ studyToken }: { studyToken: string }) {
  const [profile, setProfile] = useState<StudyProfile | null | undefined>(undefined);
  const [data, setData] = useState<UserStudyData | null>(null);
  const [activeCondition, setActiveCondition] = useState<0 | 1>(0);
  const [restored, setRestored] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "offline">("loading");
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    let active = true;
    sha256(studyToken).then((hash) => { if (active) setProfile(STUDY_TOKEN_HASHES[hash] ?? null); }).catch(() => { if (active) setProfile(null); });
    return () => { active = false; };
  }, [studyToken]);

  useEffect(() => {
    if (!profile) return;
    const verifiedProfile = profile;
    let active = true;
    async function restore() {
      let next = initialData(verifiedProfile);
      const storageKey = `rehear-user-study-${verifiedProfile.participantId}`;
      try {
        const local = window.localStorage.getItem(storageKey);
        if (local) next = { ...next, ...JSON.parse(local) };
      } catch { window.localStorage.removeItem(storageKey); }
      try {
        const snapshot = await getDoc(doc(firestore, "userStudyResponses", studyToken));
        if (snapshot.exists()) {
          const remote = snapshot.data() as UserStudyData;
          if (new Date(remote.updatedAt).getTime() >= new Date(next.updatedAt).getTime()) next = remote;
        }
        if (active) setSaveState("saved");
      } catch { if (active) setSaveState("offline"); }
      if (active) {
        setData(next);
        setActiveCondition(next.conditions[0].completedAt ? 1 : 0);
        setRestored(true);
      }
    }
    restore();
    return () => { active = false; };
  }, [profile, studyToken]);

  useEffect(() => {
    if (!restored || !data) return;
    const timer = window.setTimeout(() => {
      const next = { ...data, updatedAt: new Date().toISOString() };
      window.localStorage.setItem(`rehear-user-study-${data.participantId}`, JSON.stringify(next));
      setSaveState("saving");
      setDoc(doc(firestore, "userStudyResponses", studyToken), { ...next, serverUpdatedAt: serverTimestamp() }, { merge: true })
        .then(() => { setSaveState("saved"); setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })); })
        .catch(() => setSaveState("offline"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, restored, studyToken]);

  const completion = useMemo(() => {
    if (!data) return [0, 0];
    return data.conditions.map((condition) => Math.round((Object.values(condition.answers).filter(Boolean).length / surveyItems.length) * 100));
  }, [data]);

  if (profile === undefined) return <main className="study-loading" role="status">개인 연구 링크를 확인하고 있습니다.</main>;
  if (profile === null) return <InvalidStudyLink />;
  if (!data) return <main className="study-loading" role="status">저장된 응답을 불러오고 있습니다.</main>;

  const current = data.conditions[activeCondition];
  const isComplete = completion[activeCondition] === 100;

  function setAnswer(itemId: string, value: number) {
    setData((existing) => {
      if (!existing) return existing;
      const conditions = [...existing.conditions] as [ConditionResponse, ConditionResponse];
      conditions[activeCondition] = { ...conditions[activeCondition], answers: { ...conditions[activeCondition].answers, [itemId]: value } };
      return { ...existing, conditions };
    });
  }

  async function submitCondition() {
    const existingData = data;
    if (!existingData) return;
    if (!isComplete) {
      window.alert("응답하지 않은 문항이 있습니다. 모든 문항에 답해주세요.");
      return;
    }
    const now = new Date().toISOString();
    const conditions = [...existingData.conditions] as [ConditionResponse, ConditionResponse];
    conditions[activeCondition] = { ...conditions[activeCondition], completedAt: now };
    if (activeCondition === 0) {
      conditions[1] = { ...conditions[1], startedAt: conditions[1].startedAt || now };
      setData({ ...existingData, conditions, submissionStatus: "condition1_submitted", updatedAt: now });
      setActiveCondition(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const finalized: UserStudyData = { ...existingData, conditions, submissionStatus: "submitted", updatedAt: now };
      setData(finalized);
      try {
        await setDoc(doc(firestore, "userStudyResponses", studyToken), { ...finalized, serverUpdatedAt: serverTimestamp() }, { merge: true });
        window.alert("두 조건의 설문 응답이 모두 제출되었습니다. 감사합니다.");
      } catch {
        window.alert("기기에는 저장되었지만 서버 전송에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 제출해주세요.");
      }
    }
  }

  return <main className="user-study-shell">
    <header className="study-header"><StudyLogo /><div><span>USER STUDY</span><strong>{data.participantId}</strong></div></header>
    <section className="study-hero">
      <div><p className="eyebrow light">RE:HEAR · CONDITION POST-SURVEY</p><h1>방금 경험한 발표 조건에<br />대해 응답해주세요.</h1><p>두 조건을 비교하지 말고, 방금 경험한 조건만 떠올리며 답해주세요.</p></div>
      <aside><small>현재 단계</small><strong>{activeCondition + 1} / 2</strong><span>{saveState === "saving" ? "자동 저장 중" : saveState === "offline" ? "기기에 임시 저장됨" : `${savedAt || "현재"} 자동 저장됨`}</span></aside>
    </section>
    <nav className="condition-progress" aria-label="조건별 설문 진행 순서">
      {[0, 1].map((index) => <button key={index} type="button" disabled={index === 1 && !data.conditions[0].completedAt} className={activeCondition === index ? "active" : data.conditions[index].completedAt ? "done" : ""} onClick={() => setActiveCondition(index as 0 | 1)}><span>{data.conditions[index].completedAt ? "✓" : index + 1}</span><b>{index + 1}번째 발표 조건</b><em>{completion[index]}%</em></button>)}
    </nav>
    {data.submissionStatus === "submitted" && <section className="study-complete"><span>✓</span><div><h2>모든 응답이 제출되었습니다.</h2><p>이 창을 닫고 연구자의 다음 안내를 따라주세요.</p></div></section>}
    <section className="study-instruction"><div><b>7점 척도</b><span>1 전혀 그렇지 않다</span><i /> <span>7 매우 그렇다</span></div><p>정답은 없습니다. 지금 경험한 느낌에 가장 가까운 숫자를 선택해주세요.</p></section>
    <form className="condition-survey" onSubmit={(event) => { event.preventDefault(); submitCondition(); }}>
      {Array.from(new Set(surveyItems.map((item) => item.section))).map((section) => {
        const items = surveyItems.filter((item) => item.section === section);
        return <fieldset key={section}><legend><span>{section}</span><div><b>{items[0].construct}</b><small>{items.length}개 문항</small></div></legend>{items.map((item) => <article key={item.id} className={current.answers[item.id] ? "answered" : ""}><div className="survey-question"><span>{item.id.slice(1)}</span><p>{item.text}</p></div><div className="likert-seven" role="radiogroup" aria-label={item.text}>{[1, 2, 3, 4, 5, 6, 7].map((score) => <label key={score}><input type="radio" name={`${activeCondition}-${item.id}`} checked={current.answers[item.id] === score} onChange={() => setAnswer(item.id, score)} /><span>{score}</span></label>)}</div></article>)}</fieldset>;
      })}
      <div className="study-submit"><div><span>조건 {activeCondition + 1} 응답률</span><strong>{completion[activeCondition]}%</strong></div><button type="submit" disabled={!isComplete}>{activeCondition === 0 ? "첫 번째 조건 제출 후 다음으로" : "두 번째 조건 최종 제출"}<span>→</span></button></div>
    </form>
    <footer className="study-footer"><StudyLogo /><p>연구책임자 윤보라 · 서울대학교 디자인학부 · boracles@snu.ac.kr</p></footer>
  </main>;
}
