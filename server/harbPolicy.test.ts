import { describe, expect, it } from "vitest";
import { evaluateOwnerRules, inferTaskType, type PolicyRule } from "./harbPolicy";

const rules: PolicyRule[] = [
  {
    id: "allow-script",
    title: "سماح نصي منخفض الأولوية",
    description: null,
    matchTerms: "script",
    scope: "command",
    action: "allow",
    priority: 10,
    isActive: true,
  },
  {
    id: "deny-script",
    title: "منع الأوامر النصية",
    description: "تمنع التنفيذ غير المصرح.",
    matchTerms: "script",
    scope: "command",
    action: "deny",
    priority: 100,
    isActive: true,
  },
];

describe("Harb owner policy engine", () => {
  it("يصنّف العمليات الحساسة قبل تقييم القواعد", () => {
    expect(inferTaskType("شغّل أمراً في الطرفية")).toBe("command");
    expect(inferTaskType("احذف الملف القديم")).toBe("file_change");
    expect(inferTaskType("شارك التقرير مع الفريق")).toBe("data_share");
  });

  it("يقدّم القاعدة الأعلى أولوية عند تعارض القواعد", () => {
    const decision = evaluateOwnerRules("شغّل script للتنظيف", rules);
    expect(decision.outcome).toBe("deny");
    expect(decision.matchedRules[0]?.id).toBe("deny-script");
  });

  it("يطلب موافقة افتراضية لأي عملية حساسة لا تطابق قاعدة سماح", () => {
    const decision = evaluateOwnerRules("احذف النسخة المؤقتة", []);
    expect(decision.outcome).toBe("approval");
    expect(decision.taskType).toBe("file_change");
  });
});
