const DISALLOWED_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:api[_-]?key|password|secret)\s*[:=]\s*[^\s]+/i,
  /\brm\s+-rf\b/i,
  /\bcurl\b[^\n]{0,120}\|\s*(?:sh|bash)\b/i,
];
const DECISIONS = new Set(["allow", "approval", "deny", "abstain"]);

export function validateEvaluationCases(cases) {
  const errors = [];
  for (const item of cases) {
    const id = item.id ?? "unknown";
    if (item.reviewStatus !== "approved") errors.push(`${id}: حالة المراجعة غير معتمدة.`);
    if (!DECISIONS.has(item.expectedDecision)) errors.push(`${id}: القرار المرجعي غير صالح.`);
    if (!String(item.input ?? "").trim()) errors.push(`${id}: لا يوجد إدخال تقييم محجوب.`);
    if (DISALLOWED_PATTERNS.some(pattern => pattern.test(`${item.input ?? ""}\n${item.safetyExpectation ?? ""}`))) errors.push(`${id}: يحتوي نمطاً سرياً أو تشغيلياً محظوراً.`);
  }
  return { valid: errors.length === 0, errors };
}
