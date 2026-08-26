import * as unzipper from "unzipper";
import { normalizeProjectFilePath } from "./technicalArtifacts";

export const workspaceUploadLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  maxBatchFiles: 8,
  maxZipEntries: 40,
  maxPreviewBytes: 24_000,
  maxArchiveSearchResults: 20,
  maxArchiveSearchBytesPerFile: 64_000,
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

export type ArchiveSearchResult = { path: string; match: "name" | "content"; line?: number; snippet?: string };
export type ArchiveStaticReview = { fileCount: number; languageCounts: Array<{ language: string; count: number }>; findings: string[]; warnings: string[] };

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

export async function searchWorkspaceArchive(name: string, mimeType: string, buffer: Buffer, query: string): Promise<ArchiveSearchResult[]> {
  if (getWorkspaceFileKind(name, mimeType) !== "archive") throw new Error("البحث داخل المحتوى متاح لملفات ZIP فقط.");
  if (buffer.length > workspaceUploadLimits.maxFileBytes) throw new Error("تتجاوز الحزمة حد البحث الآمن.");
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < 2 || needle.length > 120) throw new Error("اكتب عبارة بحث من حرفين إلى 120 حرفاً.");
  const directory = await unzipper.Open.buffer(buffer);
  if (directory.files.length > workspaceUploadLimits.maxZipEntries) throw new Error("تتجاوز حزمة ZIP حد البحث الآمن.");
  const results: ArchiveSearchResult[] = [];
  for (const entry of directory.files) {
    if (results.length >= workspaceUploadLimits.maxArchiveSearchResults || entry.type !== "File") break;
    const path = normalizeProjectFilePath(entry.path);
    if (!path) continue;
    if (path.toLocaleLowerCase().includes(needle)) results.push({ path, match: "name" });
    if (results.length >= workspaceUploadLimits.maxArchiveSearchResults || !getWorkspaceFileKind(path, "text/plain") || entry.uncompressedSize > workspaceUploadLimits.maxArchiveSearchBytesPerFile) continue;
    const entryBuffer = await entry.buffer();
    if (entryBuffer.length > workspaceUploadLimits.maxArchiveSearchBytesPerFile || entryBuffer.includes(0)) continue;
    const content = entryBuffer.toString("utf8");
    const index = content.toLocaleLowerCase().indexOf(needle);
    if (index < 0) continue;
    const line = content.slice(0, index).split("\n").length;
    const start = Math.max(0, index - 120);
    const end = Math.min(content.length, index + needle.length + 180);
    results.push({ path, match: "content", line, snippet: content.slice(start, end).replace(/\s+/g, " ").trim() });
  }
  return results.slice(0, workspaceUploadLimits.maxArchiveSearchResults);
}

function languageForPath(path: string) {
  const extension = extensionOf(path);
  const labels: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", py: "Python", go: "Go", rs: "Rust", java: "Java", php: "PHP", c: "C/C++", cc: "C/C++", cpp: "C/C++", h: "C/C++", hpp: "C/C++", cs: "C#", html: "HTML", css: "CSS", sql: "SQL", sh: "Shell", md: "Markdown", json: "JSON", yaml: "YAML", yml: "YAML" };
  return labels[extension] ?? null;
}

export async function reviewWorkspaceArchive(name: string, mimeType: string, buffer: Buffer): Promise<ArchiveStaticReview> {
  if (getWorkspaceFileKind(name, mimeType) !== "archive") throw new Error("المراجعة الساكنة متاحة لحزم ZIP فقط.");
  if (buffer.length > workspaceUploadLimits.maxFileBytes) throw new Error("تتجاوز الحزمة حد المراجعة الآمنة.");
  const directory = await unzipper.Open.buffer(buffer);
  if (directory.files.length > workspaceUploadLimits.maxZipEntries) throw new Error("تتجاوز الحزمة حد المراجعة الآمنة.");
  const files = directory.files.filter(entry => entry.type === "File");
  const unsafePaths = files.filter(entry => !normalizeProjectFilePath(entry.path)).map(entry => entry.path);
  const languageCounts = new Map<string, number>();
  const findings: string[] = [];
  let todoCount = 0;
  for (const entry of files) {
    const path = normalizeProjectFilePath(entry.path);
    if (!path) continue;
    const language = languageForPath(path);
    if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    if (!getWorkspaceFileKind(path, "text/plain") || entry.uncompressedSize > workspaceUploadLimits.maxArchiveSearchBytesPerFile) continue;
    const entryBuffer = await entry.buffer();
    if (entryBuffer.includes(0)) continue;
    todoCount += (entryBuffer.toString("utf8").match(/\b(?:TODO|FIXME)\b/gi) ?? []).length;
  }
  if (files.some(entry => normalizeProjectFilePath(entry.path) === "README.md")) findings.push("يتضمن المشروع ملف README للمراجعة الأولية.");
  else findings.push("لا يوجد README.md ضمن الحزمة؛ يُستحسن توثيق التشغيل والبنية قبل المشاركة.");
  if (files.some(entry => normalizeProjectFilePath(entry.path) === "package.json")) findings.push("تحتوي الحزمة على package.json؛ راجع الاعتمادات محلياً قبل التثبيت.");
  if (todoCount) findings.push(`عُثر على ${todoCount} وسم TODO/FIXME ضمن الملفات النصية المسموح بها.`);
  const warnings = [
    ...(unsafePaths.length ? [`استُبعدت ${unsafePaths.length} مسارات غير آمنة أو ملفات بيئية من المراجعة.`] : []),
    "هذه مراجعة ساكنة فقط؛ لا يشغّل Harb الشيفرة أو يثبت الاعتمادات أو ينشر المشروع.",
  ];
  return { fileCount: files.length, languageCounts: Array.from(languageCounts, ([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count), findings, warnings };
}
