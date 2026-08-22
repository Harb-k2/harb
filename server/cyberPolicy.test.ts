import { describe, expect, it } from "vitest";
import { evaluateCyberOperation, type CyberAssetPolicy } from "./cyberPolicy";

const authorizedAsset: CyberAssetPolicy = {
  id: "asset-1",
  name: "بيئة اختبار",
  assetValue: "lab.example.local",
  assetType: "web_app",
  environment: "lab",
  authorizationRef: "AUTH-001",
  permittedScope: "تحليل واختبار تطبيق الويب ضمن نافذة التفويض.",
  status: "authorized",
  validUntil: new Date(Date.now() + 60_000),
};

describe("قانون Harb السيبراني", () => {
  it("يرفض أي عملية على أصل غير مسجل", () => {
    expect(evaluateCyberOperation(undefined, "analysis").decision).toBe("deny");
  });

  it("يسمح بالتحليل المصرح به دون تشغيل نشط", () => {
    const decision = evaluateCyberOperation(authorizedAsset, "analysis");
    expect(decision.decision).toBe("allow");
    expect(decision.riskLevel).toBe("low");
  });

  it("يطالب بموافقة صريحة للاختبار النشط حتى ضمن أصل مصرح", () => {
    const decision = evaluateCyberOperation(authorizedAsset, "active_test");
    expect(decision.decision).toBe("approval");
    expect(decision.riskLevel).toBe("high");
  });

  it("يطبق قرار الحظر الذي يحدده المالك حتى على أصل مفوض", () => {
    const decision = evaluateCyberOperation(authorizedAsset, "analysis", {
      analysisAction: "deny",
      passiveAction: "allow",
      activeAction: "approval",
      localAction: "approval",
      requireAuthorizationAcknowledgment: true,
    });
    expect(decision.decision).toBe("deny");
  });

  it("يرفض الأصل المعلّق أو المنتهي", () => {
    expect(evaluateCyberOperation({ ...authorizedAsset, status: "suspended" }, "passive_validation").decision).toBe("deny");
    expect(evaluateCyberOperation({ ...authorizedAsset, validUntil: new Date(Date.now() - 1) }, "analysis").decision).toBe("deny");
  });
});
