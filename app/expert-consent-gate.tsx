"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

export type ConsentRecord = {
  documentVersion: "2026-08-14";
  confirmations: {
    informationRead: boolean;
    risksBenefitsPayment: boolean;
    voluntaryParticipation: boolean;
    dataProcessing: boolean;
    authorizedReview: boolean;
    withdrawalRight: boolean;
    copyAvailable: boolean;
  };
  recordingConsent: "동의함" | "동의하지 않음" | "";
  quotationConsent: "동의함" | "동의하지 않음" | "";
  withdrawalDataUseConsent: "동의함" | "동의하지 않음" | "";
  participantName: string;
  consentDate: string;
  completedAt: string | null;
};

export const emptyConsentRecord = (consentDate: string): ConsentRecord => ({
  documentVersion: "2026-08-14",
  confirmations: {
    informationRead: false,
    risksBenefitsPayment: false,
    voluntaryParticipation: false,
    dataProcessing: false,
    authorizedReview: false,
    withdrawalRight: false,
    copyAvailable: false,
  },
  recordingConsent: "",
  quotationConsent: "",
  withdrawalDataUseConsent: "",
  participantName: "",
  consentDate,
  completedAt: null,
});

const requiredItems: Array<{ key: keyof ConsentRecord["confirmations"]; text: string }> = [
  { key: "informationRead", text: "연구참여자용 설명문을 읽었으며, 연구자에게 질문하고 설명을 들을 기회가 있었음을 확인합니다." },
  { key: "risksBenefitsPayment", text: "예상 가능한 불편과 이득, 사례 지급 내용을 이해했으며 질문에 대한 답변을 얻었습니다." },
  { key: "voluntaryParticipation", text: "E·V·C 청중 상태 모델 및 AI 청중 백채널 표현 구조에 관한 전문가 자문(독립 평가 및 후속 면담)에 자발적으로 참여하는 데 동의합니다." },
  { key: "dataProcessing", text: "전문가 평가·의견 및 VR 발표 영상 반응 검토자료를 관련 법률과 생명윤리위원회 규정이 허용하는 범위에서 연구자가 수집·처리하는 데 동의합니다." },
  { key: "authorizedReview", text: "연구 진행·결과 관리 및 관계 기관의 점검 시 비밀보장 원칙 아래 연구자료를 확인할 수 있음을 이해하고 동의합니다." },
  { key: "withdrawalRight", text: "언제든 참여를 철회할 수 있으며, 철회 결정으로 어떠한 불이익도 받지 않음을 이해합니다." },
  { key: "copyAvailable", text: "동의를 완료하면 입력한 이메일 주소로 연구 설명문과 동의 내용의 사본이 자동 전송됨을 확인합니다." },
];

const consentMailerUrl = "https://script.google.com/macros/s/AKfycbyAx2krR9_7gDvi8SZiER9QWOXZB0p7qXfH0ZusDTkn02dpeLus963hsQ6Rkg2Is3Njog/exec";

type ConsentMailPayload = {
  participantId: string;
  accessToken: string;
  email: string;
  documentVersion: string;
  consent: ConsentRecord;
};

function sendConsentCopy(payload: ConsentMailPayload) {
  return new Promise<void>((resolve, reject) => {
    const receiptId = crypto.randomUUID();
    const frameName = `rehear-consent-mailer-${receiptId}`;
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const input = document.createElement("input");
    let settled = false;

    iframe.name = frameName;
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");
    form.method = "POST";
    form.action = consentMailerUrl;
    form.target = frameName;
    form.hidden = true;
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify({
      receiptId,
      participantId: payload.participantId,
      accessToken: payload.accessToken,
      email: payload.email,
      documentVersion: payload.documentVersion,
      consent: {
        participantName: payload.consent.participantName,
        completedAt: payload.consent.completedAt,
        purpose: payload.consent.confirmations.informationRead,
        duration: payload.consent.confirmations.risksBenefitsPayment,
        voluntary: payload.consent.confirmations.voluntaryParticipation,
        privacy: payload.consent.confirmations.dataProcessing,
        compensation: payload.consent.confirmations.risksBenefitsPayment,
        contact: payload.consent.confirmations.authorizedReview && payload.consent.confirmations.withdrawalRight,
        copyAvailable: payload.consent.confirmations.copyAvailable,
        recordingConsent: payload.consent.recordingConsent === "동의함",
        quotationConsent: payload.consent.quotationConsent === "동의함",
        withdrawalDataUseConsent: payload.consent.withdrawalDataUseConsent === "동의함",
      },
    });

    const cleanup = () => {
      window.removeEventListener("message", receiveResult);
      window.clearTimeout(timeoutId);
      form.remove();
      window.setTimeout(() => iframe.remove(), 100);
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const receiveResult = (event: MessageEvent) => {
      if (!["https://script.google.com", "https://script.googleusercontent.com"].includes(event.origin)) return;
      const message = event.data as { source?: string; status?: string; receiptId?: string; detail?: string } | null;
      if (!message || message.source !== "rehear-consent-mailer" || message.receiptId !== receiptId) return;
      if (message.status === "success") finish(resolve);
      else finish(() => reject(new Error(message.detail || "사본을 발송하지 못했습니다.")));
    };

    const timeoutId = window.setTimeout(() => finish(() => reject(new Error("이메일 발송 확인 시간이 초과되었습니다. 다시 시도해주세요."))), 30000);
    window.addEventListener("message", receiveResult);
    form.appendChild(input);
    document.body.append(iframe, form);
    form.submit();
  });
}

function ChoicePair({ name, value, onChange }: { name: string; value: string; onChange: (value: "동의함" | "동의하지 않음") => void }) {
  return <div className="consent-choice-pair">{(["동의함", "동의하지 않음"] as const).map((option) => <label key={option} className={value === option ? "selected" : ""}><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} /><span>{option}</span></label>)}</div>;
}

export function ExpertConsentGate({ participantId, consentDate, verifiedEmail, accessToken, onComplete }: { participantId: string; consentDate: string; verifiedEmail: string; accessToken: string; onComplete: (consent: ConsentRecord) => void }) {
  const [consent, setConsent] = useState<ConsentRecord>(() => emptyConsentRecord(consentDate));
  const [deliveryStatus, setDeliveryStatus] = useState<"idle" | "sending" | "error">("idle");
  const [deliveryError, setDeliveryError] = useState("");
  const allRequiredChecked = useMemo(() => Object.values(consent.confirmations).every(Boolean), [consent.confirmations]);
  const optionalChoicesCompleted = Boolean(consent.recordingConsent && consent.quotationConsent && consent.withdrawalDataUseConsent);
  const canContinue = allRequiredChecked && optionalChoicesCompleted && Boolean(consent.participantName.trim()) && deliveryStatus !== "sending";

  function updateConfirmation(key: keyof ConsentRecord["confirmations"], checked: boolean) {
    setConsent((current) => ({ ...current, confirmations: { ...current.confirmations, [key]: checked } }));
  }

  async function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) return;
    const completedConsent = { ...consent, participantName: consent.participantName.trim(), completedAt: new Date().toISOString() };
    setDeliveryStatus("sending");
    setDeliveryError("");
    try {
      await sendConsentCopy({ participantId, accessToken, email: verifiedEmail, documentVersion: completedConsent.documentVersion, consent: completedConsent });
      window.alert("연구 설명문과 동의 내용의 사본이 이메일로 전송되었습니다.");
      onComplete(completedConsent);
    } catch (error) {
      setDeliveryStatus("error");
      setDeliveryError(error instanceof Error ? error.message : "사본을 발송하지 못했습니다. 다시 시도해주세요.");
    }
  }

  return <main className="consent-gate" aria-labelledby="consent-title">
    <div className="consent-shell">
      <header className="consent-hero">
        <div><p className="eyebrow light">RE:HEAR · INFORMED CONSENT</p><span className="consent-participant">PARTICIPANT · {participantId}</span><h1 id="consent-title">연구 설명을 확인하고<br />참여 여부를 결정해주세요.</h1><p>평가를 시작하기 전에 연구 목적과 절차, 개인정보 처리, 참여자의 권리를 확인하고 동의해주세요.</p></div>
        <aside><b>연구책임자 윤보라</b><span>서울대학교 미술대학 디자인학부 박사과정</span><strong>010-8867-0903</strong><a href="mailto:boracles@snu.ac.kr">boracles@snu.ac.kr</a></aside>
      </header>

      <section className="consent-summary" aria-labelledby="consent-summary-title">
        <div className="consent-section-heading"><span>01</span><div><b id="consent-summary-title">전문가 검토 개요</b><small>연구참여자용 설명문과 함께 검토 목적, 소요시간 및 참여 관련 사항을 확인해주세요.</small></div></div>
        <div className="consent-summary-grid"><article><small>PURPOSE</small><b>연구 목적</b><p>E·V·C 청중 상태 모델과 AI 청중의 비언어적 백채널 표현 구조를 점검하고 프레임워크 V2를 보완합니다.</p></article><article><small>TIME</small><b>예상 소요시간</b><p>독립 평가 30–45분, 후속 면담 20–30분으로 최초 참여에는 총 50–75분이 소요됩니다.</p></article><article><small>RISK</small><b>예상 가능한 불편</b><p>자료·영상 검토에 따른 피로와 비판적 의견 작성에 따른 부담이 있을 수 있습니다.</p></article><article><small>HONORARIUM</small><b>전문가 자문료</b><p>독립 평가 완료 시 150,000원, 후속 면담까지 완료 시 총 300,000원을 지급합니다.</p></article></div>
        <div className="consent-rights"><b>자발적 참여와 중도 철회</b><p>참여 여부는 자율적으로 결정할 수 있으며 언제든 불이익 없이 중단할 수 있습니다. 수집된 식별 가능한 자료의 폐기를 요청할 수 있습니다.</p></div>
        <details className="consent-full-information"><summary>연구참여자용 설명문 전체 내용 확인하기</summary><div>
          <article><span>01</span><div><b>연구 목적</b><p>문헌을 바탕으로 구성한 프레임워크 V1의 E·V·C 청중 상태 모델과 백채널 표현 구조가 발표 맥락에서 이론적·실무적으로 적절한지 점검하고, 수집된 평가와 의견으로 프레임워크 V2와 사용자 실험용 시스템을 보완합니다.</p></div></article>
          <article><span>02</span><div><b>참여 인원</b><p>전문가 검토에는 관련 분야 전문가 6명이 참여하며, 사용자 실험 참여자를 포함한 전체 연구대상자 수는 최대 48명입니다.</p></div></article>
          <article><span>03</span><div><b>참여 절차</b><p>전문가 기본정보 작성, 프레임워크·모델·코드북 검토, 약 3분 분량의 VR 발표 영상 샘플 2개 시청, 4점 척도 평가와 서면 의견 작성, 1:1 후속 면담 순서로 진행합니다. 큰 수정이 있을 경우 10–15분의 선택적 서면 재확인을 요청할 수 있습니다.</p></div></article>
          <article><span>04</span><div><b>참여 기간</b><p>독립 평가와 후속 면담을 포함한 최초 참여는 약 50–75분이며, 선택적 서면 재확인이 필요한 경우 약 10–15분이 추가될 수 있습니다.</p></div></article>
          <article><span>05</span><div><b>중도 철회</b><p>언제든 불이익 없이 참여를 중단할 수 있습니다. 철회 시 식별 가능한 평가자료·서면 의견·면담 기록·녹음파일의 폐기를 요청할 수 있으며, 이미 익명화되어 다른 자료와 통합된 경우 개별 회수가 어려울 수 있습니다.</p></div></article>
          <article><span>06</span><div><b>예상 가능한 불편과 위험</b><p>자료와 영상 검토에 따른 피로·눈의 피로와 전문적·비판적 의견을 작성하는 데 따른 부담이 있을 수 있습니다. 언제든 휴식하거나 원하지 않는 문항에 응답하지 않을 수 있습니다.</p></div></article>
          <article><span>07</span><div><b>기대되는 이득</b><p>직접적인 개인적 이득이 보장되지는 않지만, 참여자의 전문적 판단은 VR 발표 훈련 환경의 AI 청중 반응을 더 타당하고 자연스럽게 설계하는 데 기여할 수 있습니다.</p></div></article>
          <article><span>08</span><div><b>참여하지 않을 권리</b><p>참여하지 않거나 중도에 철회하더라도 업무·연구·교육·연구비 지원·평가 또는 연구책임자와의 관계에 어떠한 불이익도 없습니다.</p></div></article>
          <article><span>09</span><div><b>개인정보와 연구자료 보호</b><p>성명·연락처·서명·지급정보와 연구자료를 분리하고 전문가 번호를 부여합니다. 전자자료는 접근권한이 설정된 공간에 보관하며, 녹음파일은 전사·분석과 확인 후 삭제합니다. 서면 동의서는 3년, 식별정보를 제거한 연구자료는 연구 종료 후 5년간 보관한 뒤 폐기합니다.</p></div></article>
          <article><span>10</span><div><b>전문가 자문료</b><p>독립 평가 완료 시 150,000원, 독립 평가와 후속 면담을 모두 완료하면 총 300,000원을 지급합니다. 이미 완료한 절차에 해당하는 자문료는 중도 철회 시에도 지급하며, 녹음 동의와 재확인 참여 여부는 지급에 영향을 주지 않습니다.</p></div></article>
          <article><span>11</span><div><b>문의처</b><p>연구 문의: 윤보라 · 010-8867-0903 · boracles@snu.ac.kr<br />참여자 권리 문의: 서울대학교 생명윤리위원회 · 02-880-5153 · irb@snu.ac.kr</p></div></article>
        </div></details>
        <div className="consent-document-actions"><p>동의를 완료하면 연구 설명문과 동의 내용의 사본이 확인된 이메일 주소로 자동 전송됩니다. 연구 내용이나 동의 항목에 궁금한 점이 있으면 동의 전에 연구책임자에게 질문해주세요.</p></div>
      </section>

      <form className="consent-form" onSubmit={submitConsent}>
        <div className="consent-section-heading"><span>02</span><div><b>연구 참여 및 전문가 자문 동의</b><small>필수 확인 항목을 모두 읽고 체크해주세요.</small></div></div>
        <div className="consent-required-list">{requiredItems.map((item, index) => <label key={item.key} className={consent.confirmations[item.key] ? "checked" : ""}><input type="checkbox" checked={consent.confirmations[item.key]} onChange={(event) => updateConfirmation(item.key, event.target.checked)} /><span className="consent-item-number">{String(index + 1).padStart(2, "0")}</span><span>{item.text}</span></label>)}</div>

        <div className="consent-options">
          <article><div><span>08-1</span><b>후속 면담 녹음</b><p>면담 녹음은 별도 동의한 경우에만 진행하며, 동의하지 않아도 전문가 자문에 참여할 수 있습니다.</p></div><ChoicePair name="recording-consent" value={consent.recordingConsent} onChange={(recordingConsent) => setConsent((current) => ({ ...current, recordingConsent }))} /></article>
          <article><div><span>08-2</span><b>익명화된 의견·발췌문 인용</b><p>성명·소속 등 직접식별정보를 제거한 서면 의견 또는 면담 발췌문의 학술논문·학술대회 인용 여부를 선택해주세요.</p></div><ChoicePair name="quotation-consent" value={consent.quotationConsent} onChange={(quotationConsent) => setConsent((current) => ({ ...current, quotationConsent }))} /></article>
          <article><div><span>09</span><b>중도 철회 시 기존 자료 활용</b><p>중도 포기 또는 중도 탈락 시 그동안 수집된 자료를 연구에 계속 활용하는 데 동의하는지 선택해주세요.</p></div><ChoicePair name="withdrawal-data-consent" value={consent.withdrawalDataUseConsent} onChange={(withdrawalDataUseConsent) => setConsent((current) => ({ ...current, withdrawalDataUseConsent }))} /></article>
        </div>

        <div className="consent-signature">
          <label><span>전문가 검토 참여자 성명</span><input type="text" autoComplete="name" value={consent.participantName} onChange={(event) => setConsent((current) => ({ ...current, participantName: event.target.value }))} placeholder="성명을 입력해주세요" /></label>
          <label><span>동의일</span><input type="date" value={consent.consentDate} readOnly aria-readonly="true" tabIndex={-1} /></label>
        </div>
        <div className="consent-submit"><div><p>이름을 입력하고 아래 버튼을 누르면 위 내용에 대한 참여 동의 의사를 전자적으로 표시하게 됩니다. 동의하지 않는 경우 이 페이지를 닫아주세요.</p>{deliveryError && <p className="consent-delivery-error" role="alert">{deliveryError}</p>}</div><button className="button primary" type="submit" disabled={!canContinue}>{deliveryStatus === "sending" ? "사본 전송 중…" : "동의하고 평가 시작하기"} <span>→</span></button></div>
      </form>
      <footer className="consent-footer"><span>참여자 권리 문의 · 서울대학교 생명윤리위원회</span><b>02-880-5153 · irb@snu.ac.kr</b></footer>
    </div>
  </main>;
}
