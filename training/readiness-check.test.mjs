import test from "node:test";
import assert from "node:assert/strict";
import { assessReadiness } from "./readiness-check.mjs";

test("يحجب التدريب عند غياب اعتماد الحقوق أو تقرير الأساس أو هدف GPU", () => {
  const result = assessReadiness({ manifest: { humanReviewer: "pending_owner_review", reviewedAt: null, sources: [{ id: "source-a", rightsStatus: "review_required" }] }, baselineReport: {}, gpuTarget: {} });
  assert.equal(result.ready, false);
  assert.equal(result.blockers.length, 4);
});

test("يعلن الجاهزية فقط عند اكتمال بوابات المصدر والتقييم وGPU", () => {
  const result = assessReadiness({ manifest: { humanReviewer: "security-owner", reviewedAt: "2026-08-23T00:00:00Z", sources: [{ id: "source-a", rightsStatus: "approved_for_training" }] }, baselineReport: { results: [{ model: "baseline" }] }, gpuTarget: { provider: "approved-gpu-environment", approvedBy: "security-owner", storageEncryption: true, accessControl: true } });
  assert.deepEqual(result, { ready: true, blockers: [] });
});
