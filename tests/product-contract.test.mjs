import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("ships the core single-exercise review flow", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /上传视频/);
  assert.match(page, /训练动作/);
  assert.match(page, /重量/);
  assert.match(page, /剩余次数/);
  assert.match(page, /用户填写动作/);
  assert.match(page, /整体证据置信度/);
  assert.match(page, /观察：/);
  assert.match(page, /意义：/);
  assert.match(page, /行动：/);
});

test("keeps safety and privacy boundaries visible", async () => {
  const [page, privacy, safety] = await Promise.all([
    source("app/page.tsx"),
    source("docs/PRIVACY.md"),
    source("docs/SAFETY.md"),
  ]);
  assert.match(page, /不提供医疗诊断/);
  assert.match(page, /不会上传或永久保存视频/);
  assert.match(privacy, /明确授权/);
  assert.match(safety, /停止动作/);
});

test("validates video readiness before using an uploaded clip", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /MAX_VIDEO_BYTES = 200/);
  assert.match(page, /MIN_VIDEO_SECONDS = 10/);
  assert.match(page, /MAX_VIDEO_SECONDS = 60/);
  assert.match(page, /全身与器械轨迹完整入镜/);
  assert.match(page, /镜头固定，没有跟随缩放/);
  assert.match(page, /关键关节无遮挡、无旁人重叠/);
  assert.match(page, /动作技术仍未经过真实视觉模型复核/);
});

test("counts distinct same-muscle training days and supports local deletion", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /new Set\(/);
  assert.match(page, /entry\.muscleGroup === selectedMuscleGroup/);
  assert.match(page, /entry\.sessionDate/);
  assert.match(page, /data-growth-state/);
  assert.match(page, /删除本机记录/);
  assert.match(page, /removeItem\("formproof-history"\)/);
  assert.doesNotMatch(page, /history\.filter\(\(entry\) => entry\.movement !== movement\)/);
});

test("does not retain starter preview markers", async () => {
  const [page, layout, packageJson] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
    source("package.json"),
  ]);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

