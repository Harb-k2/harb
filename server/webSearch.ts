export type WebSearchMode = "multi" | "google" | "bing" | "news" | "images";
export type SearchRequestDefinition = { engine: "google" | "bing"; label: string; params: Record<string, string> };
export type SearchSource = { title: string; url: string; snippet: string; source: string; position: number; imageUrl?: string };

export function buildSearchRequests(query: string, mode: WebSearchMode, language: "ar" | "en") {
  const shared = { q: query, hl: language, safe: "active" };
  if (mode === "bing") return [{ engine: "bing", label: "Bing", params: shared } satisfies SearchRequestDefinition];
  if (mode === "news") return [{ engine: "google", label: "Google News", params: { ...shared, tbm: "nws" } } satisfies SearchRequestDefinition];
  if (mode === "images") return [{ engine: "google", label: "Google Images", params: { ...shared, tbm: "isch" } } satisfies SearchRequestDefinition];
  if (mode === "google") return [{ engine: "google", label: "Google", params: shared } satisfies SearchRequestDefinition];
  return [
    { engine: "google", label: "Google", params: shared },
    { engine: "bing", label: "Bing", params: shared },
  ];
}

export function extractSearchSources(payload: Record<string, unknown>, label: string) {
  const candidates = Array.isArray(payload.images_results)
    ? payload.images_results
    : Array.isArray(payload.news_results)
      ? payload.news_results
      : Array.isArray(payload.organic_results)
        ? payload.organic_results
        : [];
  return candidates.slice(0, 8).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const url = typeof record.link === "string" ? record.link : typeof record.original === "string" ? record.original : "";
    const title = typeof record.title === "string" ? record.title : "مصدر بلا عنوان";
    if (!url) return [];
    return [{
      title,
      url,
      snippet: typeof record.snippet === "string" ? record.snippet : typeof record.source === "string" ? record.source : "",
      source: typeof record.source === "string" ? record.source : label,
      position: typeof record.position === "number" ? record.position : index + 1,
      ...(typeof record.thumbnail === "string" ? { imageUrl: record.thumbnail } : {}),
    } satisfies SearchSource];
  });
}
