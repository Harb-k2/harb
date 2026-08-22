export type HarbScope = "all" | "general" | "command" | "file_change" | "data_share";
export type HarbRuleAction = "allow" | "approval" | "deny";

export type PolicyRule = {
  id: string;
  title: string;
  description: string | null;
  matchTerms: string;
  scope: HarbScope;
  action: HarbRuleAction;
  priority: number;
  isActive: boolean;
};

export type PolicyDecision = {
  outcome: HarbRuleAction;
  taskType: HarbScope;
  reason: string;
  matchedRules: PolicyRule[];
};

const containsAny = (value: string, terms: string) =>
  terms
    .split(",")
    .map(term => term.trim().toLocaleLowerCase())
    .filter(Boolean)
    .some(term => value.toLocaleLowerCase().includes(term));

export function inferTaskType(request: string): HarbScope {
  const value = request.toLocaleLowerCase();
  if (/(تشغيل|نفّذ|نفذ|أمر|command|terminal|cmd|powershell|bash|script)/.test(value)) return "command";
  if (/(حذف|امسح|تعديل ملف|انقل ملف|delete|remove|modify file)/.test(value)) return "file_change";
  if (/(مشاركة|شارك|أرسل|ارفع|share|send|upload|publish)/.test(value)) return "data_share";
  return "general";
}

export function evaluateOwnerRules(request: string, rules: PolicyRule[]): PolicyDecision {
  const taskType = inferTaskType(request);
  const matchingRules = rules
    .filter(rule => rule.isActive)
    .filter(rule => rule.scope === "all" || rule.scope === taskType)
    .filter(rule => containsAny(request, rule.matchTerms) || rule.scope === taskType && !rule.matchTerms.trim())
    .sort((a, b) => b.priority - a.priority);

  const leadingRule = matchingRules[0];
  if (leadingRule) {
    const outcomeLabel = leadingRule.action === "deny" ? "رفض" : leadingRule.action === "approval" ? "موافقة صريحة" : "سماح";
    return {
      outcome: leadingRule.action,
      taskType,
      reason: `طُبّقت قاعدة «${leadingRule.title}» ذات الأولوية ${leadingRule.priority}، وقرارها: ${outcomeLabel}.`,
      matchedRules: matchingRules,
    };
  }

  if (taskType === "command" || taskType === "file_change" || taskType === "data_share") {
    return {
      outcome: "approval",
      taskType,
      reason: "يحتوي الطلب على عملية حساسة؛ يلزم تأكيد صريح من المالك قبل التنفيذ.",
      matchedRules: [],
    };
  }

  return {
    outcome: "allow",
    taskType,
    reason: "لم يطابق الطلب قاعدة تمنعه أو تتطلب موافقة إضافية.",
    matchedRules: [],
  };
}

export function toPolicyPrompt(rules: PolicyRule[]) {
  const activeRules = rules
    .filter(rule => rule.isActive)
    .sort((a, b) => b.priority - a.priority)
    .map(rule => `- [${rule.action}] ${rule.title}: ${rule.description ?? "لا يوجد وصف"} | الكلمات: ${rule.matchTerms || "كامل النطاق"}`)
    .join("\n");

  return `أنت Harb، مساعد مهام احترافي تتواصل بالعربية. اتبع قوانين المالك التالية كإرشادات تشغيلية، ولا تدّعِ تنفيذ أمر أو تعديل ملف أو مشاركة بيانات؛ فالمنصة تعالج تلك العمليات عبر موافقات منفصلة. اشرح حدودك بوضوح واقترح مساراً آمناً عند الحاجة.\n\nقوانين المالك النشطة:\n${activeRules || "لا توجد قواعد مخصصة حالياً."}`;
}
