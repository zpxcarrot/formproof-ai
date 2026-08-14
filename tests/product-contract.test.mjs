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
