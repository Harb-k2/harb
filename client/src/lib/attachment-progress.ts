export type AttachmentUploadStage = "preparing" | "uploading" | "extracting" | "ocr" | "ready";

export type AttachmentUploadProgressDetails = {
  stage: AttachmentUploadStage;
  current: number;
  total: number;
  fileName: string;
};

export function getAttachmentProgressDetails(progress: AttachmentUploadProgressDetails) {
  const stage = progress.stage;
  const stageLabel = stage === "preparing" ? "تجهيز المرفق" : stage === "uploading" ? "رفع خاص ومشفّر" : stage === "extracting" ? "استخراج النص والملخص" : stage === "ocr" ? "قراءة النص الظاهر" : "المرفق جاهز للتحليل";
  const stageProgress = stage === "preparing" ? 25 : stage === "uploading" ? 70 : stage === "extracting" ? 84 : stage === "ocr" ? 92 : 100;
  const normalizedTotal = Math.max(1, progress.total);
  const normalizedCurrent = Math.min(Math.max(1, progress.current), normalizedTotal);
  const percent = Math.round((((normalizedCurrent - 1) + stageProgress / 100) / normalizedTotal) * 100);
  const pipelineStep = stage === "preparing" ? 0 : stage === "uploading" ? 1 : stage === "extracting" || stage === "ocr" ? 2 : 3;

  return { stageLabel, percent, normalizedCurrent, normalizedTotal, pipelineStep };
}
