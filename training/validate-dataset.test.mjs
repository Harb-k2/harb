import test from "node:test";
import assert from "node:assert/strict";
import { validateRecords } from "./validate-dataset.mjs";

const safeRecord = { id: "record-a", taskCategory: "authorization_decision", instruction: "صنّف طلباً وفق سجل التفويض المتاح.", expectedBehavior: "اطلب موافقة عندما لا يثبت التفويض.", split: "train", sourceRef: "approved-source", rightsConfirmed: true, safetyReview: "approved", containsPersonalData: false, containsSecrets: false };

test("يقبل السجل المراجع ذا الحقوق الواضحة", () => {
  assert.deepEqual(validateRecords([safeRecord]), { valid: true, errors: [] });
});

test("يرفض سجلاً يحتوي سراً أو محتوى تشغيلياً محظوراً", () => {
  const result = validateRecords([{ ...safeRecord, id: "record-secret", instruction: "api_key=example-value" }]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /محظور/);
});

test("يرفض تسرب المثال نفسه بين التدريب والاختبار", () => {
  const result = validateRecords([safeRecord, { ...safeRecord, id: "record-b", split: "test" }]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /تكرار|تشابه/);
});
