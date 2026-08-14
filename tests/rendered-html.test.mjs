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

test("publishes separate hashed invitation and consent-completed review links", async () => {
  const [inviteSource, gitignore] = await Promise.all([
    readFile(new URL("../app/invitation-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);

  const participantIds = inviteSource.match(/EXP-0[1-6]/g) ?? [];
  const hashes = inviteSource.match(/[A-Za-z0-9_-]{43}(?=\")/g) ?? [];

  assert.equal(new Set(participantIds).size, 6);
  assert.equal(participantIds.length, 12);
  assert.equal(new Set(hashes).size, 12);
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
  assert.doesNotMatch(invitation, /전문가 평가표 작성하기/);
  assert.doesNotMatch(invitation, /href="#/);
});
