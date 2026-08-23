import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareTrainingRun } from "./prepare-run.mjs";

const base = { taskCategory: "authorization_decision", instruction: "صنف طلباً وفق سجل التفويض المعتمد.", expectedBehavior: "اطلب الموافقة عند غياب التفويض.", sourceRef: "approved-source", rightsConfirmed: true, safetyReview: "approved", containsPersonalData: false, containsSecrets: false };

test("ينشئ ميتاداتا تجربة فقط بعد نجاح فحوص التدريب والتحقق والاختبار", async () => {
  const folder = await mkdtemp(join(tmpdir(), "harb-training-"));
  const recordsPath = join(folder, "records.jsonl");
  const outputPath = join(folder, "run.json");
  await writeFile(recordsPath, ["train", "validation", "test"].map((split, index) => JSON.stringify({ ...base, id: `case-${index}`, split, instruction: `${base.instruction} ${split}` })).join("\n"));
  const result = await prepareTrainingRun({ recordsPath, outputPath, baseModel: "example-base-model", method: "lora", ownerApprovalRef: "approval-001" });
  const saved = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(result.status, "planned");
  assert.equal(saved.recordCounts.test, 1);
});
