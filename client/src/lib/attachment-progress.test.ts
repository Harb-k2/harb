import { describe, expect, it } from "vitest";
import { getAttachmentProgressDetails } from "./attachment-progress";

describe("getAttachmentProgressDetails", () => {
  it("يعرض مرحلة الرفع الخاصة ونسبة متناسبة مع ترتيب المرفق", () => {
    const details = getAttachmentProgressDetails({ stage: "uploading", current: 2, total: 3, fileName: "evidence.pdf" });

    expect(details).toMatchObject({ stageLabel: "رفع خاص ومشفّر", normalizedCurrent: 2, normalizedTotal: 3, pipelineStep: 1 });
    expect(details.percent).toBe(57);
  });

  it("يضبط قيم التقدم غير الصالحة ويكمل المسار عند جاهزية المرفق", () => {
    const details = getAttachmentProgressDetails({ stage: "ready", current: 9, total: 0, fileName: "capture.png" });

    expect(details).toMatchObject({ stageLabel: "المرفق جاهز للتحليل", normalizedCurrent: 1, normalizedTotal: 1, pipelineStep: 3, percent: 100 });
  });
});
