"use client";

import { type FormEvent, useEffect, useState } from "react";
import { EMAIL_HASHES, INVITE_HASHES, REVIEW_HASHES } from "./invitation-data";
import { getExpertProfile } from "./expert-profiles";
import { ExpertReviewForm } from "./expert-review-form-v2";

type AccessState =
  | { status: "checking" }
  | { status: "denied" }
  | { status: "granted"; participantId: string; mode: "invite" | "review"; token: string };

const phoneDisplay = "010-8867-0903";
const email = "boracles@snu.ac.kr";

function RehearLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`logo-lockup${inverse ? " inverse" : ""}`}
      aria-label="Re:hear"
      style={inverse ? undefined : { WebkitMaskImage: 'url("./rehear-logo-white.svg")', maskImage: 'url("./rehear-logo-white.svg")' }}
    >
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
          <span className="contact-detail">전화 · {phoneDisplay}</span>
          <a className="text-link" href={`mailto:${email}`}>
            이메일로 문의하기 · {email}
          </a>
        </div>
        <small>링크에는 개인 성명 대신 익명 참여자 ID가 연결됩니다.</small>
      </section>
    </main>
  );
}

function EmailVerificationGate({ participantId, onVerified }: { participantId: string; onVerified: (email: string) => void }) {
  const [emailValue, setEmailValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setChecking(true);
    try {
      const normalizedEmail = emailValue.trim().toLowerCase();
      const emailHash = await sha256(normalizedEmail);
      if (normalizedEmail && EMAIL_HASHES[participantId] === emailHash) {
        onVerified(normalizedEmail);
        return;
      }
      setError("등록된 이메일 주소와 일치하지 않습니다. 초대받은 이메일을 다시 확인해주세요.");
    } catch {
      setError("이메일을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="gate-shell email-gate-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <section className="gate-card email-gate-card" aria-labelledby="email-gate-title">
        <RehearLogo />
        <p className="eyebrow">REHEAR · INVITED EXPERT</p>
        <span className="email-gate-id">PARTICIPANT · {participantId}</span>
        <h1 id="email-gate-title">초대받은 이메일을<br />확인해주세요.</h1>
        <form className="email-gate-form" onSubmit={verifyEmail} noValidate>
          <label htmlFor="participant-email">이메일 주소</label>
          <input
            id="participant-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={emailValue}
            onChange={(event) => setEmailValue(event.target.value)}
            placeholder="name@university.ac.kr"
            required
            aria-describedby={error ? "email-gate-error" : "email-gate-note"}
          />
          {error && <p className="email-gate-error" id="email-gate-error" role="alert">{error}</p>}
          <button type="submit" className="button primary" disabled={checking || !emailValue.trim()}>
            {checking ? "확인 중…" : "이메일 확인 후 계속"} <span>→</span>
          </button>
        </form>
        <small id="email-gate-note">입력한 이메일은 일치 여부 확인에만 사용하며 저장하지 않습니다.</small>
      </section>
    </main>
  );
}

function ExpertReviewPage({ participantId, reviewToken, verifiedEmail }: { participantId: string; reviewToken: string; verifiedEmail: string }) {
  return (
    <main className="review-only">
      <header className="site-header">
        <div className="brand" aria-label="ReHear 전문가 검토">
          <RehearLogo />
          <span className="brand-divider" />
          <span className="brand-sub">Structured expert review</span>
        </div>
        <div className="participant-pill" aria-label={`참여자 ID ${participantId}`}>
          <span>PARTICIPANT</span>
          <strong>{participantId}</strong>
        </div>
      </header>

      <section className="review-entry" aria-labelledby="review-entry-title">
        <div>
          <p className="eyebrow">REHEAR · STRUCTURED EXPERT REVIEW</p>
          <h1 id="review-entry-title">AI 청중 에이전트<br />전문가 평가</h1>
          <p className="review-entry-copy">
            <span>E·V·C 청중 상태 모델과 영상 구간별 AI 청중 반응을 4점 척도로 평가하고 의견을 작성합니다.</span>
            <span className="withdrawal-line">참여를 중단하거나 동의를 철회하려면 언제든 연구책임자에게 알려주세요.</span>
          </p>
        </div>
        <aside>
          <b>평가 소요시간</b>
          <span>약 30–45분</span>
          <span>작성 중 · 자동 임시 저장</span>
          <span>완료 후 · 제출 버튼으로 최종 전달</span>
          <p className="contact-detail"><strong>연구책임자 윤보라</strong> · <strong>{phoneDisplay}</strong></p>
          <a href={`mailto:${email}`}>이메일로 문의하기 · {email}</a>
        </aside>
      </section>

      <ExpertReviewForm participantId={participantId} reviewToken={reviewToken} verifiedEmail={verifiedEmail} />

      <footer>
        <div className="footer-brand"><RehearLogo inverse /><span>Expert Review</span></div>
        <p>서울대학교 디자인학부 · 연구책임자 윤보라</p>
        <p>개별 초대받은 전문가를 위한 평가 페이지입니다.</p>
      </footer>
    </main>
  );
}

export function ExpertInvitation() {
  const [access, setAccess] = useState<AccessState>({ status: "checking" });
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [reviewStarted, setReviewStarted] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (active) setVerifiedEmail("");
      if (active) setReviewStarted(false);
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
          setAccess(participantId ? { status: "granted", participantId, mode: route.mode, token: route.token } : { status: "denied" });
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

  if (!verifiedEmail) {
    return (
      <EmailVerificationGate
        participantId={access.participantId}
        onVerified={(normalizedEmail) => {
          setReviewStarted(window.localStorage.getItem(`rehear-review-started-${access.participantId}`) === "true");
          setVerifiedEmail(normalizedEmail);
        }}
      />
    );
  }

  if (access.mode === "review" || reviewStarted) {
    return <ExpertReviewPage participantId={access.participantId} reviewToken={access.token} verifiedEmail={verifiedEmail} />;
  }

  const { participantId } = access;
  const expertProfile = getExpertProfile(participantId);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startReview() {
    window.localStorage.setItem(`rehear-review-started-${participantId}`, "true");
    setReviewStarted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          <p className="eyebrow light">SEOUL NATIONAL UNIVERSITY HCID LAB + TEAM AUDI</p>
          <h1>
            AI 청중의 반응 설계,
            <br />
            <em>전문가 검토</em>를
            <br />
            시작합니다.
          </h1>
          <p className="hero-lead">
            <span>전문가 검토에 참여해주셔서 감사합니다.</span>
            <span className="hero-lead-detail">VR 발표 훈련 환경에서 발표 수행에 따라 반응하는 AI 청중 에이전트의 백채널 디자인 프레임워크와 검토 절차를 안내드립니다.</span>
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
            <div><strong>20–30분</strong><small>1:1 면담 · 대면 또는 온라인 · 개별 일정 협의</small></div>
          </article>
        </div>
      </section>

      <nav className="section-nav" aria-label="페이지 바로가기">
        <button type="button" onClick={() => scrollToSection("overview")}>연구 소개</button>
        <button type="button" onClick={() => scrollToSection("focus")}>의뢰 배경</button>
        <button type="button" onClick={() => scrollToSection("process")}>참여 절차</button>
        <button type="button" onClick={() => scrollToSection("review-start")}>평가 시작</button>
      </nav>

      <section className="section intro" id="overview">
        <div className="section-kicker"><span>01</span> Research overview</div>
        <div className="intro-layout">
          <h2>더 자연스럽고 의미 있는<br />AI 청중 반응을 설계합니다.</h2>
          <div className="intro-body">
            <p className="lead-paragraph">
              본 연구는 VR 발표 훈련에서 발표 수행정보에 따라 AI 청중 에이전트가
              보이는 <strong>평가적 백채널의 디자인 프레임워크와 연동 규칙</strong>을
              설계하고 검증하는 연구입니다.
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

      <section className="section personalization" id="focus">
        <div className="section-kicker"><span>02</span> Why your perspective matters</div>
        <div className="personalization-head">
          <div>
            <p className="verified-expert">{expertProfile.displayName}</p>
            <h2>{expertProfile.headline}</h2>
          </div>
          <div className="invited-track" aria-label={`초대 전문 분야 ${expertProfile.label}`}>
            <div><small>전문 분야</small><strong>{expertProfile.label}</strong></div>
          </div>
        </div>
        <div className="invitation-reason">
          <span>의뢰드리는 이유</span>
          <p>{expertProfile.reason}</p>
        </div>
        <div className="focus-list" aria-label="중점 검토 요청 항목">
          <p>특히 다음 내용을 중심으로 살펴봐주세요.</p>
          <ol>
            {expertProfile.focusItems.map((item, index) => (
              <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section process" id="process">
        <div className="section-kicker"><span>03</span> Review process</div>
        <div className="process-layout">
          <div className="process-title">
            <h2>검토는 두 단계로<br />진행됩니다.</h2>
            <p>모든 일정과 방식은<br />연구책임자와 개별 협의합니다.</p>
          </div>
          <ol className="timeline">
            <li>
              <span className="step">01</span>
              <div>
                <div className="timeline-meta"><b>독립 평가</b><em>약 30–45분</em></div>
                <h3>모델과 영상 구간별 반응 검토</h3>
                <p>E·V·C 청중 상태 모델과 제공 자료를 확인하고, 영상 샘플 A·B의 발표 구간별 AI 청중 반응을 4점 척도로 평가한 뒤 판단 근거와 수정안을 작성합니다.</p>
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

      <section className="section contact review-launch" id="review-start">
        <div className="contact-panel">
          <div className="contact-copy">
            <p className="eyebrow light">START YOUR REVIEW</p>
            <h2>준비가 되셨다면<br />평가를 시작해주세요.</h2>
            <p>평가표는 약 30–45분이 소요됩니다. 작성 내용은 자동으로 임시 저장되며, 중간에 닫아도 같은 링크에서 이어서 작성할 수 있습니다.</p>
          </div>
          <div className="contact-actions">
            <div className="id-card">
              <span>나의 익명 참여자 ID</span>
              <strong>{participantId}</strong>
            </div>
            <button className="button message review-start-button" type="button" onClick={startReview}>
              전문가 평가 시작하기 <span>→</span>
            </button>
            <ul className="review-start-notes" aria-label="평가 시작 전 안내">
              <li>4점 척도 평가와 서면 의견 작성</li>
              <li>작성 중 자동 저장</li>
              <li>완료 후 제출 버튼으로 최종 전달</li>
            </ul>
            <p className="phone-link">연구책임자 윤보라 · {phoneDisplay}</p>
            <a className="phone-link" href={`mailto:${email}`}>이메일로 문의하기 · {email}</a>
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
            <p>E·V·C 청중 상태 모델과 영상 구간별 AI 청중 반응을 4점 척도로 평가하고 의견을 작성한 뒤, 연구자와 1:1 반구조화 면담을 진행합니다.</p>
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
        <p>본 페이지는 개별 초대받은 전문가를 위한 검토 및 평가 안내입니다.</p>
      </footer>
    </main>
  );
}
