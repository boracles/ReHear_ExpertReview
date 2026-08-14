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
  assert.equal(participantIds.length, 12);
  assert.equal(new Set(hashes).size, 14);
  assert.equal((inviteSource.match(/TEST-01/g) ?? []).length, 2);
  assert.match(inviteSource, /INVITE_HASHES/);
  assert.match(inviteSource, /REVIEW_HASHES/);
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
  const [form, invitation] = await Promise.all([
    readFile(new URL("../app/expert-review-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/expert-invitation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(form, /내용 적절성/);
  assert.match(form, /오해 위험/);
  assert.match(form, /프레임워크 전체 평가/);
  assert.doesNotMatch(form, /후속 반구조화 면담 메모/);
  assert.doesNotMatch(form, /interviewQuestions/);
  assert.match(form, /ReHear_\$\{participantId\}_review\.json/);
  assert.match(form, /ReHear_\$\{participantId\}_review\.csv/);
  assert.match(form, /rehear-review-\$\{participantId\}/);
  assert.match(invitation, /access\.mode === "review"/);
  assert.match(invitation, /Consent-completed review/);
  assert.match(invitation, /참여 의사 확인 → 연구 설명 및 동의 → 별도 평가 링크 전달/);
  assert.match(invitation, /이 페이지는 개별 초대 링크를 통해서만 열립니다\.\s*<br \/>/);
  assert.match(invitation, /전달받은 링크를 다시 열거나,\s*<br \/>\s*연구책임자에게 새 링크를 요청해주세요\./);
  assert.match(invitation, /SEOUL NATIONAL UNIVERSITY · HCID LAB/);
  assert.match(invitation, /mailto:\$\{email\}/);
  assert.match(invitation, /boracles@snu\.ac\.kr/);
  assert.doesNotMatch(invitation, /tel:\$\{phoneHref\}/);
  assert.match(invitation, /이메일로 문의하기/);
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
