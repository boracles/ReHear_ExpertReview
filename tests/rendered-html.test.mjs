import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const activeForm = new URL("../app/expert-review-form-v2.tsx", import.meta.url);
const consentGate = new URL("../app/expert-consent-gate.tsx", import.meta.url);

test("exports the Korean expert invitation shell", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");

  assert.match(html, /<html lang="ko">/);
  assert.match(html, /ReHear/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("includes mobile and tablet responsive layouts", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /export const viewport: Viewport/);
  assert.match(layout, /width: "device-width"/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(max-width: 380px\)/);
  assert.match(css, /min-height: 100svh/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /\.hero-facts \{[\s\S]*?margin-top: 34px;[\s\S]*?position: relative;/);
  assert.match(css, /\.section-nav \{[\s\S]*?max-width: 1440px;[\s\S]*?width: calc\(100% - 40px\);/);
  assert.match(css, /\.section-nav \{ gap: 24px; padding: 0 18px; top: 74px; width: calc\(100% - 16px\); \}/);
});

test("publishes separate hashed invitation and consent-completed review links", async () => {
  const [inviteSource, gitignore] = await Promise.all([
    readFile(new URL("../app/invitation-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);

  const participantIds = inviteSource.match(/EXP-0[1-6]/g) ?? [];
  const hashes = inviteSource.match(/[A-Za-z0-9_-]{43}(?=\")/g) ?? [];

  assert.equal(new Set(participantIds).size, 6);
  assert.equal(participantIds.length, 18);
  assert.equal(new Set(hashes).size, 21);
  assert.equal((inviteSource.match(/TEST-01/g) ?? []).length, 3);
  assert.match(inviteSource, /INVITE_HASHES/);
  assert.match(inviteSource, /REVIEW_HASHES/);
  assert.match(inviteSource, /EMAIL_HASHES/);
  assert.doesNotMatch(inviteSource, /@example\.com/);
  assert.doesNotMatch(inviteSource, /github\.io\/.+#\/invite\//);
  assert.match(gitignore, /^\/private\/$/m);
});

test("includes the Pages deployment assets", async () => {
  const [robots, workflow, nextConfig] = await Promise.all([
    readFile(new URL("public/robots.txt", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
    readFile(new URL("next.config.ts", root), "utf8"),
  ]);

  assert.match(robots, /Disallow: \//);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path: dist\/client/);
  assert.match(workflow, /test -d dist\/client\/_next\/static/);
  assert.match(nextConfig, /https:\/\/boracles\.art/);
});

test("includes the complete expert review workflow without breaking invite hashes", async () => {
  const [form, invitation, profiles] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../app/expert-invitation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/expert-profiles.ts", import.meta.url), "utf8"),
  ]);

  assert.match(form, /모델 구성 적절성/);
  assert.match(form, /오해 위험/);
  assert.match(form, /프레임워크 전체 평가/);
  assert.match(form, /전문가 기본 정보/);
  assert.match(form, /검토 자료 정보/);
  assert.match(form, /후속 면담 일정/);
  assert.match(form, /기타 전문영역/);
  assert.match(form, /otherExpertise/);
  assert.match(form, /placeholder="예: 10년"/);
  assert.match(form, /관련 분야 최종 학위/);
  assert.doesNotMatch(form, /other_expertise/);
  assert.match(form, />면담 방식</);
  assert.match(form, />면담 녹음 여부</);
  assert.match(form, /희망 장소/);
  assert.match(form, /가능한 날짜 및 시간 후보군/);
  assert.match(form, /preferredLocation/);
  assert.match(form, /interviewAvailability/);
  assert.match(form, /프레임워크 개발에 필요한 내용을 기록한 뒤 녹음 자료를 폐기합니다/);
  assert.ok(form.indexOf("E·V·C 청중 상태 모델 평가") < form.indexOf("review-scale-note"));
  assert.doesNotMatch(form, /후속 반구조화 면담 메모/);
  assert.doesNotMatch(form, /interviewQuestions/);
  assert.doesNotMatch(form, /function exportJson/);
  assert.doesNotMatch(form, /function exportCsv/);
  assert.doesNotMatch(form, /JSON 내려받기/);
  assert.doesNotMatch(form, /CSV 내려받기/);
  assert.match(form, /rehear-review-\$\{participantId\}/);
  assert.match(invitation, /access\.mode === "review"/);
  assert.match(invitation, /설계하고 검증하는 연구입니다/);
  assert.doesNotMatch(invitation, /개발하는 연구입니다/);
  assert.match(invitation, /\.\/expert-review-form-v2/);
  assert.match(invitation, /type="email"/);
  assert.match(invitation, /EMAIL_HASHES\[participantId\] === emailHash/);
  assert.match(invitation, /입력한 이메일은 일치 여부 확인에만 사용하며 저장하지 않습니다/);
  assert.match(invitation, /Structured expert review/);
  assert.doesNotMatch(invitation, /설명 및 동의 절차 완료 후 제공되는 페이지/);
  assert.doesNotMatch(invitation, /Consent-completed review/);
  assert.match(invitation, /동의를 철회하려면 언제든 연구책임자에게/);
  assert.match(invitation, /review-entry-copy/);
  assert.match(invitation, /전문가 평가 시작하기/);
  assert.match(invitation, /작성 중 · 자동 임시 저장/);
  assert.match(invitation, /<b>평가 소요시간<\/b>/);
  assert.match(invitation, /<span>약 30–45분<\/span>/);
  assert.doesNotMatch(invitation, /평가 전 확인|예상 소요시간 ·/);
  assert.doesNotMatch(invitation, /기기 및 보안 서버 자동 저장/);
  assert.doesNotMatch(invitation, /기기와 보안 서버에 자동 저장/);
  assert.match(invitation, /rehear-review-started-/);
  assert.match(invitation, /access\.mode === "review" \|\| reviewStarted/);
  assert.doesNotMatch(invitation, /문자로 참여 의사 전달/);
  assert.doesNotMatch(invitation, /참여 의사 확인 → 연구 설명 및 동의 → 별도 평가 링크 전달/);
  assert.match(invitation, /이 페이지는 개별 초대 링크를 통해서만 열립니다\.\s*<br \/>/);
  assert.match(invitation, /전달받은 링크를 다시 열거나,\s*<br \/>\s*연구책임자에게 새 링크를 요청해주세요\./);
  assert.match(invitation, /SEOUL NATIONAL UNIVERSITY · HCID LAB/);
  assert.match(invitation, /mailto:\$\{email\}/);
  assert.match(invitation, /boracles@snu\.ac\.kr/);
  assert.match(invitation, /<strong>\{phoneDisplay\}<\/strong>/);
  assert.doesNotMatch(invitation, /tel:\$\{phoneHref\}/);
  assert.match(invitation, /이메일로 문의하기/);
  assert.match(invitation, /Why your perspective matters/);
  assert.match(invitation, /특히 다음 내용을 중심으로 살펴봐주세요/);
  assert.doesNotMatch(invitation, /Who we are inviting/);
  assert.match(invitation, /전문가 검토를/);
  assert.match(invitation, /검토 절차를 안내드립니다/);
  assert.doesNotMatch(invitation, /전문가를 모십니다/);
  assert.match(profiles, /발표와 커뮤니케이션 관점의 검토/);
  assert.match(profiles, /Human–AI Interaction 관점의 검토/);
  assert.match(profiles, /XR과 가상 에이전트 관점의 검토/);
  assert.doesNotMatch(invitation, /전문가 평가표 작성하기/);
  assert.doesNotMatch(invitation, /href="#/);
});

test("backs up review drafts to Firestore without exposing collection listing", async () => {
  const [form, firebase, rules] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../app/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(firebase, /projectId: "rehear-83639"/);
  assert.match(form, /expertReviewResponses/);
  assert.match(form, /serverTimestamp/);
  assert.match(form, /submissionStatus/);
  assert.match(form, /검토 완료 제출/);
  assert.match(rules, /allow get: if validReviewToken/);
  assert.match(rules, /allow list: if false/);
  assert.match(rules, /allow delete: if false/);
});

test("records review versions automatically without exposing version inputs", async () => {
  const [form, workflow, css, invitation] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/expert-invitation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(form, /const DEFAULT_FRAMEWORK_VERSION = "V1"/);
  assert.match(form, /const DEFAULT_VIDEO_SAMPLE_VERSION = "V1"/);
  assert.match(form, /VITE_SYSTEM_BUILD_VERSION/);
  assert.match(form, /function todayInKorea\(\)/);
  assert.match(form, /reviewDate: todayInKorea\(\)/);
  assert.match(form, /frameworkVersion: DEFAULT_FRAMEWORK_VERSION/);
  assert.match(form, /systemBuildVersion: SYSTEM_BUILD_VERSION/);
  assert.match(form, /videoSampleVersion: DEFAULT_VIDEO_SAMPLE_VERSION/);
  assert.doesNotMatch(form, /animationSetVersion/);
  assert.doesNotMatch(form, /애니메이션 세트 버전/);
  assert.doesNotMatch(form, /<span>프레임워크 버전<\/span>/);
  assert.match(workflow, /VITE_SYSTEM_BUILD_VERSION: \$\{\{ github\.sha \}\}/);
  assert.match(css, /\.logo-lockup:not\(\.inverse\)/);
  assert.match(css, /-webkit-mask-size: contain/);
  assert.match(css, /\.logo-lockup:not\(\.inverse\) \.logo-image \{ opacity: 0; \}/);
  assert.match(invitation, /WebkitMaskImage: 'url\("\.\/rehear-logo-white\.svg"\)'/);
  assert.doesNotMatch(form, /ruleSetVersion/);
  assert.doesNotMatch(form, /rule_set_version/);
});

test("reflects the EVC review purpose and official expert information fields", async () => {
  const form = await readFile(activeForm, "utf8");

  assert.match(form, /E·V·C 청중 상태 모델/);
  assert.match(form, /발표 수행정보를 바탕으로 AI 청중의 상태를 산출/);
  assert.match(form, /프레임워크 V1을 V2로 개정/);
  assert.match(form, /otherAffiliation/);
  assert.match(form, /비공개 온라인 화상회의/);
  assert.match(form, /녹음함\(별도 동의 확인\)/);
});

test("aligns section badges and color-codes the four-point scale", async () => {
  const [form, css] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(form, /data-score=\{score\}/);
  assert.doesNotMatch(form, /data-scale=|reverse=/);
  assert.match(form, /오해 위험: 1 매우 높음 · 2 높은 편 · 3 낮은 편 · 4 매우 낮음/);
  assert.equal((form.match(/data-score="[1-4]"/g) ?? []).length, 4);
  assert.match(css, /\.legend-like b \{ display: block; line-height: 28px; \}/);
  assert.match(css, /\.legend-like > span \{ margin-top: 0; \}/);
  assert.match(form, /<span>01<\/span><div><b id="expert-info-title"/);
  assert.match(form, /<span>02<\/span><div><b id="review-material-info-title"/);
  assert.match(form, /<span>03<\/span><div><b id="interview-schedule-title"/);
  assert.match(form, /<span>04<\/span><div><b id="materials-title"/);
  assert.match(form, /<span>05<\/span><div><b id="model-title"/);
  assert.match(form, /<span>06<\/span><div><b id="model-evaluation-title"/);
  assert.match(form, /<span>07<\/span><div><b id="framework-evaluation-title">영상 샘플 및 프레임워크 전체 평가<\/b>/);
  assert.doesNotMatch(form, /<legend><span>07<\/span>/);
  assert.doesNotMatch(form, /<span>R1<\/span>|<span>R2<\/span>/);
  assert.match(form, /className=\{`unable-check \$\{answer\.unable \? "is-selected" : ""\}`\}/);
  assert.match(form, /className=\{`critical-check \$\{answer\.critical \? "is-selected" : ""\}`\}/);
  assert.match(css, /\.unable-check\.is-selected \{ background: #e7e5ff;/);
  assert.match(css, /\.critical-check\.is-selected \{ background: #c63f35;/);
  assert.equal((css.match(/\.review-scale-note span\[data-score="[1-4]"\]/g) ?? []).length, 4);
  assert.match(css, /\.review-scale-note em \{ border-top: 1px solid #e0e5f1; flex: 0 0 100%/);
  assert.equal((css.match(/\.score-picker button\[data-score="[1-4]"\]\.selected/g) ?? []).length, 4);
});

test("includes the official materials workflow and complete EVC model overview", async () => {
  const [form, css] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(form, /제공 자료 및 검토 순서/);
  assert.match(form, /프레임워크 V1 개요/);
  assert.match(form, /발표 수행정보·평가 차원 코드북/);
  assert.match(form, /발표 단계 구분과 시간 정보/);
  assert.match(form, /단계별 평가 관점의 정의와 이론적 근거/);
  assert.match(form, /VR 발표 영상 샘플 A·B/);
  assert.match(form, /1단계 독립 검토/);
  assert.match(form, /1단계 독립 검토 <em>약 30–40분<\/em>/);
  assert.match(form, /2단계 후속 면담/);
  assert.match(form, /2단계 후속 면담 <em>약 30–40분<\/em>/);
  assert.match(form, /총 소요시간/);
  assert.match(form, /약 60–80분/);
  assert.match(form, /review-step-independent/);
  assert.match(form, /document-glyph/);
  assert.match(form, /review-step-interview/);
  assert.equal((form.match(/className="person-glyph/g) ?? []).length, 3);
  assert.match(form, /speech-glyph/);
  assert.doesNotMatch(form, /<article><span>01<\/span><div><small>INDEPENDENT REVIEW/);
  assert.match(form, /E·V·C 청중 상태 모델 및 백채널 표현 구조 개요/);
  assert.match(form, /Engagement/);
  assert.match(form, /Evaluative Valence/);
  assert.match(form, /Cognitive Clarity/);
  assert.match(form, /presentation-stage-strip/);
  assert.equal((form.match(/status: "(?:필수|선택)"/g) ?? []).length, 8);
  assert.match(form, /현재의 발표 수행정보, 이전 청중 상태 및 개별 에이전트 특성/);
  assert.match(form, /표정·자세·시선·고개 움직임/);
  assert.ok(form.indexOf("제공 자료 및 검토 순서") < form.indexOf("E·V·C 청중 상태 모델 및 백채널 표현 구조 개요"));
  assert.ok(form.indexOf("E·V·C 청중 상태 모델 및 백채널 표현 구조 개요") < form.indexOf("E·V·C 청중 상태 모델 평가"));
  assert.match(form, /https:\/\/doi\.org\/10\.1093\/oso\/9780195130072\.003\.0005/);
  assert.match(form, /https:\/\/doi\.org\/10\.1080\/02699930902928969/);
  assert.match(form, /E·V·C는 본 연구에서 구성한 청중 상태 모델입니다/);
  assert.match(css, /\.materials-layout/);
  assert.match(css, /\.review-duration-summary/);
  assert.match(css, /\.review-step-icon/);
  assert.match(css, /\.speech-glyph/);
  assert.match(css, /\.evc-grid/);
  assert.match(css, /\.model-facts/);
});

test("matches the revised questionnaire and embeds video-adjacent overall ratings", async () => {
  const [form, css] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.equal((form.match(/key: "(?:modelStructure|dimensionClarity|modelCoverage|stageStructure|inputConnection|agentCharacteristics|stateUpdate|backchannelExpression|meaningInterpretation|meaningScopeRisk)"/g) ?? []).length, 10);
  assert.equal((form.match(/key: "(?:overallCoherence|timingAppropriateness|intensityFrequency|agentDistribution|trainingFit|exceptionHandling|implementationTraceability)"/g) ?? []).length, 7);
  assert.equal((form.match(/key: "(?:introduction|motivation|theory|purpose|method|results|implications|closing)"/g) ?? []).length, 8);
  assert.match(form, /판단 어려움\/전문영역 외/);
  assert.match(form, /영상 1과 영상 2를 순서대로 시청·평가한 뒤/);
  assert.match(form, /<video key=\{video\} controls playsInline preload="metadata"/);
  assert.match(form, /sample-\$\{video\.toLowerCase\(\)\}\.mp4/);
  assert.match(form, /framework-video-list/);
  assert.match(form, /framework-video-card/);
  assert.match(form, /video-review-stepper/);
  assert.match(form, /영상 1 시청·평가/);
  assert.match(form, /영상 2 시청·평가/);
  assert.match(form, /프레임워크 전체 평가/);
  assert.match(form, /video-inline-evaluation/);
  assert.match(form, /video-stage-list/);
  assert.match(form, /updateVideoStage/);
  assert.match(form, /부분적으로 적절함/);
  assert.match(form, /발표 단계 구성 적절성/);
  assert.match(form, /의미 범위 이탈 위험/);
  assert.match(form, /영상 2로 이동/);
  assert.match(form, /framework-question-section/);
  assert.doesNotMatch(form, /activeVideo|video-tabs/);
  assert.match(form, /새로움/);
  assert.match(form, /규범·자기 일치성/);
  assert.match(form, /단계별 평가 관점/);
  assert.match(form, /appraisalPerspectives/);
  assert.match(form, /Scherer \(2001\)/);
  assert.match(form, /Scherer \(2009\)/);
  assert.doesNotMatch(form, /후속 반구조화 면담 질문/);
  assert.doesNotMatch(form, /interviewQuestions/);
  assert.match(form, /ruleEvaluations: Array\.isArray\(parsed\.ruleEvaluations\)/);
  assert.match(form, /legacyResponses/);
  assert.match(form, /retiredModelAnswers/);
  assert.match(form, /retiredFrameworkAnswers/);
  assert.match(css, /\.framework-review-layout/);
  assert.match(css, /\.framework-review-layout \{ display: grid; gap: 38px; grid-template-columns: 1fr/);
  assert.match(css, /\.framework-video-list \{ display: grid; gap: 24px; grid-template-columns: 1fr/);
  assert.match(css, /\.framework-player video, \.framework-player \.video-empty \{ aspect-ratio: 16 \/ 9/);
  assert.match(css, /\.video-review-stepper \{ display: grid/);
  assert.match(css, /\.video-inline-evaluation \{ background: #fff/);
  assert.match(css, /\.video-stage-list \{ display: grid/);
  assert.match(css, /\.stage-evaluation/);
  assert.match(css, /\.theory-references/);
});

test("requires informed consent before the expert review form", async () => {
  const [form, consent, css] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(consentGate, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(form, /if \(!data\.session\.consent\.completedAt\) return <ExpertConsentGate/);
  assert.match(form, /consent: emptyConsentRecord\(todayInKorea\(\)\)/);
  assert.match(consent, /연구 설명을 확인하고/);
  assert.equal((consent.match(/key: "(?:informationRead|risksBenefitsPayment|voluntaryParticipation|dataProcessing|authorizedReview|withdrawalRight|copyAvailable)"/g) ?? []).length, 7);
  assert.match(consent, /후속 면담 녹음/);
  assert.match(consent, /익명화된 의견·발췌문 인용/);
  assert.match(consent, /중도 철회 시 기존 자료 활용/);
  assert.match(consent, /연구참여자용 설명문 전체 내용 확인하기/);
  assert.equal((consent.match(/<article><span>(?:0[1-9]|10|11)<\/span>/g) ?? []).length, 11);
  assert.match(consent, /disabled=\{!canContinue\}/);
  assert.match(css, /\.consent-gate/);
  assert.match(css, /\.consent-required-list/);
});
