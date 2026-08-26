import * as unzipper from "unzipper";
import { normalizeProjectFilePath } from "./technicalArtifacts";

export const workspaceUploadLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  maxBatchFiles: 8,
  maxZipEntries: 40,
  maxPreviewBytes: 24_000,
} as const;

const textExtensions = new Set(["txt", "md", "json", "yaml", "yml", "toml", "xml", "csv", "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "java", "go", "rs", "php", "c", "cc", "cpp", "h", "hpp", "cs", "html", "css", "scss", "sql", "sh", "bash", "zsh", "ps1", "rb", "kt", "swift", "vue", "svelte"]);
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const directMimeTypes = new Set(["application/pdf", "application/zip", "application/x-zip-compressed", "application/json", "text/plain", "text/csv", "text/markdown", "text/html", "text/css", "application/javascript", "text/javascript", "application/typescript"]);

export type WorkspaceFileKind = "image" | "document" | "archive" | "code" | "text";
export type WorkspaceInspection = {
  kind: WorkspaceFileKind;
  summary: string;
  textPreview?: string;
  truncated?: boolean;
  archiveFiles?: Array<{ path: string; size: number; text: boolean }>;
};

function extensionOf(name: string) {
  const last = name.trim().toLowerCase().split(".").pop();
  return last && last !== name.toLowerCase() ? last : "";
}

export function getWorkspaceFileKind(name: string, mimeType: string): WorkspaceFileKind | null {
  const normalizedMimeType = mimeType.toLowerCase();
  const extension = extensionOf(name);
  if (imageMimeTypes.has(normalizedMimeType)) return "image";
  if (normalizedMimeType === "application/zip" || normalizedMimeType === "application/x-zip-compressed" || extension === "zip") return "archive";
  if (normalizedMimeType === "application/pdf" || ["doc", "docx", "pdf"].includes(extension)) return "document";
  if (textExtensions.has(extension)) return ["js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "java", "go", "rs", "php", "c", "cc", "cpp", "h", "hpp", "cs", "html", "css", "scss", "sql", "sh", "bash", "zsh", "ps1", "rb", "kt", "swift", "vue", "svelte"].includes(extension) ? "code" : "text";
  return directMimeTypes.has(normalizedMimeType) ? "text" : null;
}

export function validateWorkspaceUpload(name: string, mimeType: string, size: number) {
  if (!name.trim() || size <= 0) throw new Error("الملف المرفوع غير صالح.");
  if (size > workspaceUploadLimits.maxFileBytes) throw new Error("الحد الأقصى للملف الواحد هو 10 ميغابايت.");
  const kind = getWorkspaceFileKind(name, mimeType);
  if (!kind) throw new Error("يدعم Harb الصور وPDF وZIP والملفات النصية وملفات الشيفرة فقط في الرفع المتعدد.");
  return kind;
}

function textPreview(buffer: Buffer) {
  if (buffer.includes(0)) return null;
  const content = buffer.toString("utf8");
  return { content: content.slice(0, workspaceUploadLimits.maxPreviewBytes), truncated: content.length > workspaceUploadLimits.maxPreviewBytes };
}

export async function inspectWorkspaceBuffer(name: string, mimeType: string, buffer: Buffer): Promise<WorkspaceInspection> {
  const kind = validateWorkspaceUpload(name, mimeType, buffer.length);
  if (kind === "image") return { kind, summary: "صورة خاصة جاهزة للمعاينة والتحليل البصري ضمن قانون المالك." };
  if (kind === "document") return { kind, summary: "مستند خاص محفوظ داخل مساحة العمل؛ يمكن ربطه بتحليل Harb وفق نوعه وقانون المالك." };
  if (kind === "code" || kind === "text") {
    const preview = textPreview(buffer);
    return { kind, summary: kind === "code" ? "تم التعرف على ملف شيفرة نصي قابل للمعاينة." : "تم التعرف على ملف نصي قابل للمعاينة.", ...(preview ? { textPreview: preview.content, truncated: preview.truncated } : {}) };
  }
  const directory = await unzipper.Open.buffer(buffer);
  if (directory.files.length > workspaceUploadLimits.maxZipEntries) throw new Error("تتجاوز حزمة ZIP حد 40 ملفاً للمعاينة الآمنة.");
  const archiveFiles = directory.files
    .filter(file => file.type === "File")
    .slice(0, workspaceUploadLimits.maxZipEntries)
    .map(file => ({ path: normalizeProjectFilePath(file.path), size: file.uncompressedSize }))
    .filter((file): file is { path: string; size: number } => Boolean(file.path))
    .map(file => ({ ...file, text: Boolean(getWorkspaceFileKind(file.path, "text/plain")) }));
  return { kind, summary: `حزمة ZIP خاصة تضم ${archiveFiles.length} ملفاً آمناً للعرض الوصفي.`, archiveFiles };
}
