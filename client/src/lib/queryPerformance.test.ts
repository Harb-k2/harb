import { describe, expect, it } from "vitest";
import { harbQueryDefaults, shouldLoadControlAudit } from "./queryPerformance";

describe("استعلامات أداء Harb", () => {
  it("يؤجل سجل التدقيق حتى يفتح المالك مركز التحكم", () => {
    expect(shouldLoadControlAudit(true, "assistant")).toBe(false);
    expect(shouldLoadControlAudit(false, "control")).toBe(false);
    expect(shouldLoadControlAudit(true, "control")).toBe(true);
  });

  it("يستخدم تخزيناً مؤقتاً قصيراً ويمنع إعادة الجلب عند استعادة تركيز النافذة", () => {
    expect(harbQueryDefaults.staleTime).toBeGreaterThan(0);
    expect(harbQueryDefaults.refetchOnWindowFocus).toBe(false);
    expect(harbQueryDefaults.retry).toBe(1);
  });
});
