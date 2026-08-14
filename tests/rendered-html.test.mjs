import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const activeForm = new URL("../app/expert-review-form-v2.tsx", import.meta.url);

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
  assert.doesNotMatch(form, /관련 분야 최종 학위/);
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

test("prefills review metadata and removes the unused rule-set version", async () => {
  const form = await readFile(activeForm, "utf8");

  assert.match(form, /const DEFAULT_FRAMEWORK_VERSION = "V1"/);
  assert.match(form, /function todayInKorea\(\)/);
  assert.match(form, /reviewDate: todayInKorea\(\)/);
  assert.match(form, /frameworkVersion: DEFAULT_FRAMEWORK_VERSION/);
  assert.match(form, /animationSetVersion/);
  assert.match(form, /애니메이션 세트 버전/);
  assert.match(form, /aria-readonly="true"/);
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
  assert.equal((css.match(/\.review-scale-note span\[data-score="[1-4]"\]/g) ?? []).length, 4);
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
  assert.match(form, /대표 발표 맥락/);
  assert.match(form, /실제 또는 목업 애니메이션 클립/);
  assert.match(form, /1단계 독립 검토/);
  assert.match(form, /2단계 후속 면담/);
  assert.match(form, /E·V·C 청중 상태 모델 개요/);
  assert.match(form, /Engagement/);
  assert.match(form, /Evaluative Valence/);
  assert.match(form, /Cognitive Clarity/);
  assert.doesNotMatch(form, /도입부, 연구 동기, 이론적 틀\(선택\)/);
  assert.match(form, /현재의 발표 수행정보와 이전 청중 상태/);
  assert.match(form, /표정·자세·시선·고개 움직임/);
  assert.ok(form.indexOf("제공 자료 및 검토 순서") < form.indexOf("E·V·C 청중 상태 모델 개요"));
  assert.ok(form.indexOf("E·V·C 청중 상태 모델 개요") < form.indexOf("E·V·C 청중 상태 모델 평가"));
  assert.match(form, /https:\/\/doi\.org\/10\.1093\/oso\/9780195130072\.003\.0005/);
  assert.match(form, /https:\/\/doi\.org\/10\.1080\/02699930902928969/);
  assert.match(form, /E·V·C는 본 연구에서 구성한 청중 상태 모델입니다/);
  assert.match(css, /\.materials-layout/);
  assert.match(css, /\.evc-grid/);
  assert.match(css, /\.model-facts/);
});

test("matches the revised questionnaire and embeds video-adjacent overall ratings", async () => {
  const [form, css] = await Promise.all([
    readFile(activeForm, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.equal((form.match(/key: "(?:modelStructure|dimensionClarity|modelCoverage|inputConnection|stateUpdate|backchannelExpression|misunderstandingRisk)"/g) ?? []).length, 7);
  assert.equal((form.match(/key: "(?:inputCoverage|stateExpressionConnection|responsePrinciples|trainingRange|exceptionPrinciples|implementationExplainability)"/g) ?? []).length, 6);
  assert.doesNotMatch(form, /stageStructure|agentCharacteristics|meaningInterpretation|meaningScopeRisk/);
  assert.match(form, /판단 어려움\/전문영역 외/);
  assert.match(form, /실제 또는 목업 애니메이션 클립을 확인하면서 평가해주세요/);
  assert.match(form, /<video key=\{activeVideo\} controls playsInline preload="metadata"/);
  assert.match(form, /sample-\$\{activeVideo\.toLowerCase\(\)\}\.mp4/);
  assert.match(form, /video-player-sticky/);
  assert.match(form, /video-tabs/);
  assert.doesNotMatch(form, /새로움|규범·자기 일치성|단계별 평가 관점/);
  assert.match(form, /Scherer \(2001\)/);
  assert.match(form, /Scherer \(2009\)/);
  assert.doesNotMatch(form, /후속 반구조화 면담 질문/);
  assert.doesNotMatch(form, /interviewQuestions/);
  assert.match(form, /ruleEvaluations: Array\.isArray\(parsed\.ruleEvaluations\)/);
  assert.match(form, /legacyResponses/);
  assert.match(form, /retiredModelAnswers/);
  assert.match(form, /retiredFrameworkAnswers/);
  assert.match(css, /\.framework-review-layout/);
  assert.match(css, /\.video-player-sticky \{ position: sticky/);
  assert.match(css, /\.video-tabs/);
  assert.match(css, /\.theory-references/);
});
