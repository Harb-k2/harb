import { createHash } from "node:crypto";
import { storageGetSignedUrl } from "./storage";

const supportedMimeTypes = new Set(["text/plain", "text/markdown", "text/csv", "application/csv", "application/json", "text/json"]);
const maxBytes = 1_000_000;
const maxExcerptLength = 1200;
const maxChunks = 80;

export function isSupportedKnowledgeSource(mimeType: string | null) {
  return Boolean(mimeType && supportedMimeTypes.has(mimeType.toLowerCase()));
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/[\t ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function buildChunks(text: string) {
  const units = normalizeText(text).split(/\n\s*\n|\n/).map(unit => unit.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    const clipped = unit.slice(0, maxExcerptLength);
    if (current && current.length + clipped.length + 1 > maxExcerptLength) {
      chunks.push(current);
      current = clipped;
    } else current = current ? `${current}\n${clipped}` : clipped;
    if (chunks.length >= maxChunks) break;
  }
  if (current && chunks.length < maxChunks) chunks.push(current);
  return chunks.map(excerpt => ({ excerpt, contentHash: createHash("sha256").update(excerpt).digest("hex") }));
}

export async function indexKnowledgeStorageObject(storageKey: string, mimeType: string | null) {
  if (!isSupportedKnowledgeSource(mimeType)) return { status: "unsupported" as const, chunks: [] };
  const signedUrl = await storageGetSignedUrl(storageKey);
  const response = await fetch(signedUrl, { headers: { Range: `bytes=0-${maxBytes - 1}` } });
  if (!response.ok) throw new Error(`تعذر قراءة مصدر المعرفة (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("يتجاوز المصدر حد الفهرسة الآمن في الإصدار الأول.");
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const chunks = buildChunks(text);
  if (!chunks.length) throw new Error("لم يعثر Harb على محتوى نصي صالح للفهرسة.");
  return { status: "ready" as const, chunks };
}
