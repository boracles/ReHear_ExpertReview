"use client";

import { useEffect, useMemo, useState } from "react";
import { INVITE_HASHES, REVIEW_HASHES } from "./invitation-data";
import { ExpertReviewForm } from "./expert-review-form";

type AccessState =
  | { status: "checking" }
  | { status: "denied" }
  | { status: "granted"; participantId: string; mode: "invite" | "review" };

const phoneDisplay = "010-8867-0903";
const phoneHref = "01088670903";
const email = "boracles@snu.ac.kr";

function RehearLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`logo-lockup${inverse ? " inverse" : ""}`} aria-label="Re:hear">
      <img className="logo-image" src="./rehear-logo-white.svg" alt="" aria-hidden="true" />
    </span>
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToBase64Url(new Uint8Array(digest));
}

function tokenFromHash() {
  const match = window.location.hash.match(/^#\/(invite|review)\/([A-Za-z0-9_-]{32,})$/);
  if (!match) return null;
  return { mode: match[1] as "invite" | "review", token: match[2] };
}

function AccessGate() {
  return (
    <main className="gate-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <section className="gate-card" aria-labelledby="gate-title">
        <RehearLogo />
        <p className="eyebrow">REHEAR · EXPERT REVIEW</p>
        <h1 id="gate-title">전문가 검토 초대 링크를 확인해주세요.</h1>
        <p>
          이 페이지는 개별 초대 링크를 통해서만 열립니다.
          <br />
          전달받은 링크를 다시 열거나,
          <br />
          연구책임자에게 새 링크를 요청해주세요.
        </p>
        <div className="gate-contact-links" aria-label="연구책임자 문의">
          <a className="text-link" href={`tel:${phoneHref}`}>
            전화 · {phoneDisplay}
          </a>
          <a className="text-link" href={`mailto:${email}`}>
            이메일 · {email}
          </a>
        </div>
        <small>링크에는 개인 성명 대신 익명 참여자 ID가 연결됩니다.</small>
      </section>
    </main>
  );
}

function ExpertReviewPage({ participantId }: { participantId: string }) {
  return (
    <main className="review-only">
      <header className="site-header">
        <div className="brand" aria-label="ReHear 전문가 검토">
          <RehearLogo />
          <span className="brand-divider" />
          <span className="brand-sub">Consent-completed review</span>
        </div>
        <div className="participant-pill" aria-label={`참여자 ID ${participantId}`}>
          <span>PARTICIPANT</span>
          <strong>{participantId}</strong>
        </div>
      </header>

      <section className="review-entry" aria-labelledby="review-entry-title">
        <div>
          <p className="eyebrow">REHEAR · STRUCTURED EXPERT REVIEW</p>
          <span className="consent-status">설명 및 동의 절차 완료 후 제공되는 페이지</span>
          <h1 id="review-entry-title">AI 청중 에이전트<br />전문가 평가</h1>
          <p>
            이 평가 링크는 연구 설명을 듣고 참여에 동의한 전문가에게만 개별적으로
            제공됩니다. 참여를 중단하고 싶거나 동의를 철회하려면 언제든 연구책임자에게
            알려주세요.
          </p>
        </div>
        <aside>
          <b>평가 전 확인</b>
          <span>예상 소요시간 · 약 30–45분</span>
          <span>입력 내용 · 현재 기기에만 임시 저장</span>
          <span>완료 후 · JSON과 CSV 파일 전달</span>
          <a href={`tel:${phoneHref}`}>연구책임자 윤보라 · {phoneDisplay}</a>
          <a href={`mailto:${email}`}>{email}</a>
        </aside>
      </section>

      <ExpertReviewForm participantId={participantId} />

      <footer>
        <div className="footer-brand"><RehearLogo inverse /><span>Expert Review</span></div>
        <p>서울대학교 디자인학부 · 연구책임자 윤보라</p>
        <p>동의 완료 후 제공되는 개별 전문가 평가 페이지입니다.</p>
      </footer>
    </main>
  );
}

export function ExpertInvitation() {
  const [access, setAccess] = useState<AccessState>({ status: "checking" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      const route = tokenFromHash();
      if (!route) {
        if (active) setAccess({ status: "denied" });
        return;
      }

      try {
        const hash = await sha256(route.token);
        const hashes = route.mode === "invite" ? INVITE_HASHES : REVIEW_HASHES;
        const participantId = hashes[hash];
        if (active) {
          setAccess(participantId ? { status: "granted", participantId, mode: route.mode } : { status: "denied" });
        }
      } catch {
        if (active) setAccess({ status: "denied" });
      }
    }

    verify();
    window.addEventListener("hashchange", verify);
    return () => {
      active = false;
      window.removeEventListener("hashchange", verify);
    };
  }, []);

  const messageHref = useMemo(() => {
    if (access.status !== "granted") return "";
    const body = [
      "안녕하세요. AI 청중 에이전트 백채널 디자인 프레임워크 전문가 검토와 관련해 연락드립니다.",
      `참여자 ID: ${access.participantId}`,
      "참여 의사: 참여 가능 / 추가 문의 (해당 내용을 남겨주세요)",
    ].join("\n");
    return `sms:${phoneHref}?&body=${encodeURIComponent(body)}`;
  }, [access]);

  if (access.status === "checking") {
    return (
      <main className="gate-shell" aria-live="polite">
        <div className="loader" aria-label="초대 링크 확인 중">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  if (access.status === "denied") return <AccessGate />;

  if (access.mode === "review") {
    return <ExpertReviewPage participantId={access.participantId} />;
  }

  const { participantId } = access;

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(participantId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <button className="brand" type="button" onClick={() => scrollToSection("top")} aria-label="ReHear 전문가 검토 처음으로">
          <RehearLogo />
          <span className="brand-divider" />
          <span className="brand-sub">Expert Review</span>
        </button>
        <div className="participant-pill" aria-label={`참여자 ID ${participantId}`}>
          <span>INVITED EXPERT</span>
          <strong>{participantId}</strong>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="orbit orbit-one" aria-hidden="true"><i /></div>
        <div className="orbit orbit-two" aria-hidden="true"><i /></div>
        <div className="hero-copy">
          <p className="eyebrow light">SEOUL NATIONAL UNIVERSITY · HCID LAB</p>
          <h1>
            AI 청중의 반응 설계,
            <br />
            <em>전문가의 관점이</em>
            <br />
            필요합니다.
          </h1>
          <p className="hero-lead">
            VR 발표 훈련 환경에서 발표 수행에 따라 반응하는 AI 청중 에이전트의
            백채널 디자인 프레임워크를 검토해주실 전문가를 모십니다.
          </p>
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={() => scrollToSection("overview")}>연구 내용 확인하기 <span>↓</span></button>
            <button className="button ghost" type="button" onClick={() => window.print()}>
              안내문 인쇄하기
            </button>
          </div>
        </div>
        <div className="hero-brand-stamp" aria-hidden="true">
          <RehearLogo inverse />
          <span>AI AUDIENCE<br />BACKCHANNEL DESIGN</span>
        </div>
        <div className="hero-facts" aria-label="참여 요약">
          <article>
            <span>01</span>
            <div><strong>30–45분</strong><small>독립 평가</small></div>
          </article>
          <article>
            <span>02</span>
            <div><strong>20–30분</strong><small>1:1 면담</small></div>
          </article>
          <article>
            <span>03</span>
            <div><strong>대면 또는 온라인</strong><small>개별 일정 협의</small></div>
          </article>
        </div>
      </section>

      <nav className="section-nav" aria-label="페이지 바로가기">
        <button type="button" onClick={() => scrollToSection("overview")}>연구 소개</button>
        <button type="button" onClick={() => scrollToSection("who")}>검토 대상</button>
        <button type="button" onClick={() => scrollToSection("process")}>참여 절차</button>
        <button type="button" onClick={() => scrollToSection("contact")}>참여 의사 전달</button>
      </nav>

      <section className="section intro" id="overview">
        <div className="section-kicker"><span>01</span> Research overview</div>
        <div className="intro-layout">
          <h2>더 자연스럽고 의미 있는<br />AI 청중 반응을 설계합니다.</h2>
          <div className="intro-body">
            <p className="lead-paragraph">
              본 연구는 VR 발표 훈련에서 발표 수행정보에 따라 AI 청중 에이전트가
              보이는 <strong>평가적 백채널의 디자인 프레임워크와 연동 규칙</strong>을
              개발하는 연구입니다.
            </p>
            <p>
              사용자 실험에 앞서 관련 분야 전문가의 평가를 통해 규칙의 내용 적절성,
              의미 명확성, 발표 맥락 적합성 및 구현 가능성을 검토하고자 합니다.
            </p>
          </div>
        </div>
        <div className="study-title-card">
          <span>연구 과제명</span>
          <strong>VR 발표 훈련 환경에서의 발표 수행 평가 기반<br />AI 청중 에이전트 백채널 디자인 프레임워크</strong>
          <div><small>연구책임자</small><b>윤보라 · 서울대학교 디자인학부</b></div>
        </div>
      </section>

      <section className="section eligibility" id="who">
        <div className="section-kicker"><span>02</span> Who we are inviting</div>
        <div className="eligibility-head">
          <h2>이런 전문성을 가진 분의<br />의견을 기다립니다.</h2>
          <p>아래 분야 중 하나 이상에서 연구·교육·실무 경험을 보유한 전문가</p>
        </div>
        <div className="expertise-grid">
          <article>
            <div className="number">A</div>
            <h3>발표 · 커뮤니케이션</h3>
            <p>발표 수행, 비언어적 커뮤니케이션, 발표 교육 및 평가</p>
          </article>
          <article>
            <div className="number">B</div>
            <h3>HCI · Human–AI Interaction</h3>
            <p>인간–컴퓨터 상호작용, AI 에이전트 경험 및 인터랙션 설계</p>
          </article>
          <article>
            <div className="number">C</div>
            <h3>XR · 가상 에이전트</h3>
            <p>XR 인터랙션, VR 훈련 환경, 가상 인간 및 행동 애니메이션</p>
          </article>
        </div>
      </section>

      <section className="section process" id="process">
        <div className="section-kicker"><span>03</span> Review process</div>
        <div className="process-layout">
          <div className="process-title">
            <h2>검토는 세 단계로<br />차분하게 진행됩니다.</h2>
            <p>모든 일정과 진행 방식은 연구책임자와 개별 협의합니다.</p>
          </div>
          <ol className="timeline">
            <li>
              <span className="step">01</span>
              <div>
                <div className="timeline-meta"><b>독립 평가</b><em>약 30–45분</em></div>
                <h3>프레임워크와 연동 규칙 검토</h3>
                <p>수행정보–백채널 연동 규칙, 발표 맥락, 백채널 애니메이션 예시를 살펴본 후 각 규칙을 4점 척도로 평가하고 서면 의견을 작성합니다.</p>
              </div>
            </li>
            <li>
              <span className="step">02</span>
              <div>
                <div className="timeline-meta"><b>반구조화 면담</b><em>약 20–30분</em></div>
                <h3>판단 근거와 개선 의견 나누기</h3>
                <p>연구자와 1:1로 평가 이유와 수정 방향을 이야기합니다. 면담 녹음은 별도 동의한 경우에만 진행하며, 동의하지 않아도 참여할 수 있습니다.</p>
              </div>
            </li>
            <li>
              <span className="step">03</span>
              <div>
                <div className="timeline-meta"><b>선택적 재확인</b><em>약 10–15분</em></div>
                <h3>크게 변경된 규칙만 다시 확인</h3>
                <p>의미나 구현 방식이 크게 바뀐 규칙에 한해서만 짧은 서면 재확인을 요청드릴 수 있습니다.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="section practical">
        <div className="section-kicker"><span>04</span> Practical details</div>
        <div className="detail-grid">
          <article>
            <span className="detail-label">WHEN</span>
            <h3>참여 기간</h3>
            <p>IRB 변경심의 승인 후부터<br /><strong>2026년 12월 31일</strong>까지</p>
            <small>기간 중 개별 협의한 일정에 따라 진행</small>
          </article>
          <article>
            <span className="detail-label">WHERE</span>
            <h3>참여 장소</h3>
            <p>조용한 대면 장소 또는<br /><strong>비공개 온라인 화상회의</strong></p>
            <small>Zoom 등, 연구책임자와 협의</small>
          </article>
          <article className="accent-card">
            <span className="detail-label">HONORARIUM</span>
            <h3>참여 사례</h3>
            <p>연구 참여에 대한<br /><strong>소정의 사례</strong>가 지급됩니다.</p>
            <small>세부 내용은 개별 안내</small>
          </article>
        </div>
      </section>

      <section className="section autonomy">
        <div className="autonomy-mark" aria-hidden="true">✓</div>
        <div>
          <p className="eyebrow">YOUR CHOICE MATTERS</p>
          <h2>참여 여부는 전적으로 자율적입니다.</h2>
          <p>
            검토 의뢰를 거절하거나 진행 중 참여를 중단해도 어떠한 불이익도 없습니다.
            검토 의사가 있는 경우 연구 설명문과 동의서를 먼저 제공하며, 동의 절차 후
            개별평가와 면담 일정을 협의합니다.
          </p>
        </div>
      </section>

      <section className="section contact" id="contact">
        <div className="contact-panel">
          <div className="contact-copy">
            <p className="eyebrow light">NEXT STEP</p>
            <h2>검토 가능 여부를<br />편하게 알려주세요.</h2>
            <p>아래 버튼을 누르면 참여자 ID가 포함된 문자 초안이 열립니다. 참여 의사를 확인한 뒤 연구 설명문과 동의서를 먼저 보내드립니다.</p>
          </div>
          <div className="contact-actions">
            <div className="id-card">
              <span>나의 익명 참여자 ID</span>
              <strong>{participantId}</strong>
              <button type="button" onClick={copyId} aria-live="polite">
                {copied ? "복사됨" : "ID 복사"}
              </button>
            </div>
            <a className="button message" href={messageHref}>문자로 참여 의사 전달 <span>↗</span></a>
            <a className="phone-link" href={`tel:${phoneHref}`}>연구책임자 윤보라 · {phoneDisplay}</a>
            <a className="phone-link" href={`mailto:${email}`}>이메일 · {email}</a>
            <p className="consent-next-step">참여 의사 확인 → 연구 설명 및 동의 → 별도 평가 링크 전달 순서로 진행됩니다.</p>
          </div>
        </div>
      </section>

      <section className="section faq" aria-labelledby="faq-title">
        <div>
          <div className="section-kicker"><span>05</span> Before you decide</div>
          <h2 id="faq-title">참여 전 확인해주세요.</h2>
        </div>
        <div className="faq-list">
          <details>
            <summary>면담 녹음에 동의해야 참여할 수 있나요?<i>+</i></summary>
            <p>아닙니다. 녹음은 별도 동의한 경우에만 진행되며, 녹음에 동의하지 않아도 전문가 검토에 참여할 수 있습니다.</p>
          </details>
          <details>
            <summary>평가는 어떤 방식으로 진행되나요?<i>+</i></summary>
            <p>각 규칙을 4점 척도로 평가하고 서면 의견을 작성한 뒤, 연구자와 1:1 반구조화 면담을 진행합니다.</p>
          </details>
          <details>
            <summary>참여를 시작한 뒤 중단할 수 있나요?<i>+</i></summary>
            <p>네. 참여 여부는 자율적으로 결정할 수 있으며, 진행 중 중단하더라도 어떠한 불이익도 없습니다.</p>
          </details>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><RehearLogo inverse /><span>Expert Review</span></div>
        <p>서울대학교 디자인학부 · 연구책임자 윤보라</p>
        <p>본 페이지는 개별 초대받은 전문가를 위한 참여 의사 확인 안내입니다.</p>
      </footer>
    </main>
  );
}
