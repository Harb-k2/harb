import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const REQUIRED_SPLITS = new Set(["train", "validation", "test"]);
const DISALLOWED_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:api[_-]?key|password|secret)\s*[:=]\s*[^\s]+/i,
  /\brm\s+-rf\b/i,
  /\bcurl\b[^\n]{0,120}\|\s*(?:sh|bash)\b/i,
];

const normalize = value => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const fingerprint = record => createHash("sha256").update(`${normalize(record.instruction)}\n${normalize(record.expectedBehavior)}`).digest("hex");
const tokens = value => new Set(normalize(value).split(/[^\p{L}\p{N}_-]+/u).filter(token => token.length > 2));
const overlap = (left, right) => {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return [...a].filter(token => b.has(token)).length / union.size;
};

export function validateRecords(records) {
  const errors = [];
  const fingerprints = new Map();
  for (const record of records) {
    if (!REQUIRED_SPLITS.has(record.split)) errors.push(`${record.id ?? "unknown"}: split غير صالح.`);
    if (record.rightsConfirmed !== true) errors.push(`${record.id ?? "unknown"}: لا يوجد تأكيد حقوق.`);
    if (record.safetyReview !== "approved") errors.push(`${record.id ?? "unknown"}: المراجعة الأمنية غير معتمدة.`);
    if (record.containsSecrets === true || record.containsPersonalData === true) errors.push(`${record.id ?? "unknown"}: يحتوي بيانات محظورة أو غير منزوعة الهوية.`);
    const combined = `${record.instruction ?? ""}\n${record.expectedBehavior ?? ""}`;
    if (DISALLOWED_PATTERNS.some(pattern => pattern.test(combined))) errors.push(`${record.id ?? "unknown"}: يحتوي نمطاً سرياً أو تشغيلياً محظوراً.`);
    const key = fingerprint(record);
    const prior = fingerprints.get(key);
    if (prior && prior.split !== record.split) errors.push(`${record.id ?? "unknown"}: تكرار بين ${prior.split} و${record.split}.`);
    else fingerprints.set(key, record);
  }
  for (let index = 0; index < records.length; index += 1) {
    for (let other = index + 1; other < records.length; other += 1) {
      if (records[index].split !== records[other].split && overlap(records[index].instruction, records[other].instruction) >= 0.9) errors.push(`${records[other].id ?? "unknown"}: تشابه مرتفع عبر تقسيمات البيانات.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function validateJsonlFile(filePath) {
  const text = await readFile(filePath, "utf8");
  const records = text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`السطر ${index + 1} ليس JSON صالحاً.`); }
  });
  return validateRecords(records);
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("الاستخدام: node validate-dataset.mjs <records.jsonl>");
  const result = await validateJsonlFile(filePath);
  if (!result.valid) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else console.log("اجتاز سجل التدريب فحوص الحقوق والسلامة والتسرب.");
}
