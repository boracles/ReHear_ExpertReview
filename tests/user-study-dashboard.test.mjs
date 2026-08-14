import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fromRoot = (path) => new URL(`../${path}`, import.meta.url);

test("routes individual user-study links and the private research dashboard", async () => {
  const [router, study, dashboard] = await Promise.all([
    readFile(fromRoot("app/app-router.tsx"), "utf8"),
    readFile(fromRoot("app/user-study.tsx"), "utf8"),
    readFile(fromRoot("app/research-dashboard.tsx"), "utf8"),
  ]);

  assert.match(router, /kind: "study"/);
  assert.match(router, /route\.kind === "research"/);
  assert.match(study, /userStudyResponses/);
  assert.match(study, /\{index \+ 1\}번째 발표 조건/);
  assert.match(study, /activeCondition === 0/);
  assert.match(dashboard, /전문가 검토와 사용자 실험 데이터/);
  assert.match(dashboard, /boracles@snu\.ac\.kr/);
});

test("implements the complete two-condition 22-item instrument and analysis metadata", async () => {
  const [data, study, dashboard] = await Promise.all([
    readFile(fromRoot("app/user-study-data.ts"), "utf8"),
    readFile(fromRoot("app/user-study.tsx"), "utf8"),
    readFile(fromRoot("app/research-dashboard.tsx"), "utf8"),
  ]);

  assert.equal((data.match(/id: "q\d{2}"/g) ?? []).length, 22);
  assert.match(data, /reverse: true/);
  assert.match(study, /conditionOrder/);
  assert.match(study, /frameworkVersion/);
  assert.match(study, /systemBuildVersion/);
  assert.match(study, /videoSampleVersion/);
  assert.match(dashboard, /Cohen/);
  assert.match(dashboard, /95%/);
  assert.match(dashboard, /Holm/);
  assert.match(dashboard, /질적 코딩/);
  assert.match(dashboard, /통합 증거/);
});
