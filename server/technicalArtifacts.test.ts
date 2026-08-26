import { describe, expect, it } from "vitest";
import { createDocumentArtifact, createProjectArchive, normalizeProjectFilePath, normalizeProjectFiles, safeArtifactSlug } from "./technicalArtifacts";
import { buildSearchRequests, extractSearchSources } from "./webSearch";

describe("technical artifact safety", () => {
  it("prevents archive traversal and environment files", () => {
    expect(normalizeProjectFilePath("../secrets.txt")).toBeNull();
    expect(normalizeProjectFilePath(".env")).toBeNull();
    expect(normalizeProjectFilePath("src\\main.ts")).toBe("src/main.ts");
  });

  it("deduplicates project files and supplies a README", () => {
    const files = normalizeProjectFiles([{ path: "src/app.ts", content: "first" }, { path: "src/app.ts", content: "second" }, { path: "../bad", content: "x" }]);
    expect(files).toEqual(expect.arrayContaining([{ path: "src/app.ts", content: "first" }, expect.objectContaining({ path: "README.md" })]));
  });

  it("creates safe artifact names without replacing Arabic characters", () => {
    expect(safeArtifactSlug("تقرير Harb / الربع الأول")).toBe("تقرير-Harb-الربع-الأول");
  });

  it("creates downloadable ZIP, PDF, and Word buffers", async () => {
    const [archive, pdf, docx] = await Promise.all([
      createProjectArchive([{ path: "src/main.ts", content: "export const harb = true;" }]),
      createDocumentArtifact("تقرير Harb", "ملخص تقني باللغة العربية", "pdf"),
      createDocumentArtifact("Harb report", "Technical summary", "docx"),
    ]);

    expect(archive.subarray(0, 2).toString()).toBe("PK");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(docx.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("multi-source search normalization", () => {
  it("uses Google and Bing for the multi-source search mode", () => {
    expect(buildSearchRequests("Harb AI", "multi", "ar").map(item => item.label)).toEqual(["Google", "Bing"]);
  });

  it("normalizes source cards and excludes entries without a link", () => {
    const sources = extractSearchSources({ organic_results: [{ position: 1, title: "Official", link: "https://example.com", snippet: "source text" }, { title: "Missing link" }] }, "Google");
    expect(sources).toEqual([{ title: "Official", url: "https://example.com", snippet: "source text", source: "Google", position: 1 }]);
  });
});
