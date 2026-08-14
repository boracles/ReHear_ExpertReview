import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

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
    readFile(new URL("../app/expert-review-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/expert-invitation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/expert-profiles.ts", import.meta.url), "utf8"),
  ]);

  assert.match(form, /내용 적절성/);
  assert.match(form, /오해 위험/);
  assert.match(form, /프레임워크 전체 평가/);
  assert.match(form, /검토자 정보/);
  assert.match(form, /평가 정보/);
  assert.doesNotMatch(form, /기타 전문영역/);
  assert.doesNotMatch(form, /other_expertise/);
  assert.doesNotMatch(form, /전문가 기본 정보/);
  assert.doesNotMatch(form, />검토 기록</);
  assert.doesNotMatch(form, />면담 방식</);
  assert.doesNotMatch(form, />면담 녹음</);
  assert.ok(form.indexOf("규칙별 평가") < form.indexOf("review-scale-note"));
  assert.doesNotMatch(form, /후속 반구조화 면담 메모/);
  assert.doesNotMatch(form, /interviewQuestions/);
  assert.match(form, /ReHear_\$\{participantId\}_review\.json/);
  assert.match(form, /ReHear_\$\{participantId\}_review\.csv/);
  assert.match(form, /rehear-review-\$\{participantId\}/);
  assert.match(invitation, /access\.mode === "review"/);
  assert.match(invitation, /type="email"/);
  assert.match(invitation, /EMAIL_HASHES\[participantId\] === emailHash/);
  assert.match(invitation, /입력한 이메일은 일치 여부 확인에만 사용하며 저장하지 않습니다/);
  assert.match(invitation, /Structured expert review/);
  assert.doesNotMatch(invitation, /설명 및 동의 절차 완료 후 제공되는 페이지/);
  assert.doesNotMatch(invitation, /Consent-completed review/);
  assert.match(invitation, /동의를 철회하려면 언제든 연구책임자에게/);
  assert.match(invitation, /review-entry-copy/);
  assert.match(form, /임시 저장됩니다\.<br \/>/);
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
    readFile(new URL("../app/expert-review-form.tsx", import.meta.url), "utf8"),
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
  const form = await readFile(new URL("../app/expert-review-form.tsx", import.meta.url), "utf8");

  assert.match(form, /const DEFAULT_FRAMEWORK_VERSION = "V1"/);
  assert.match(form, /function todayInKorea\(\)/);
  assert.match(form, /reviewDate: todayInKorea\(\)/);
  assert.match(form, /frameworkVersion: DEFAULT_FRAMEWORK_VERSION/);
  assert.match(form, /aria-readonly="true"/);
  assert.doesNotMatch(form, /ruleSetVersion/);
  assert.doesNotMatch(form, /rule_set_version/);
});
