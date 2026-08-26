import { describe, expect, it } from "vitest";
import { createProjectArchive } from "./technicalArtifacts";
import { getWorkspaceFileKind, inspectWorkspaceBuffer, searchWorkspaceArchive, validateWorkspaceUpload, workspaceUploadLimits } from "./workspaceInspector";

describe("workspace upload inspection", () => {
  it("accepts supported code and archive files while rejecting unsupported binary uploads", () => {
    expect(getWorkspaceFileKind("app.ts", "application/octet-stream")).toBe("code");
    expect(getWorkspaceFileKind("evidence.zip", "application/zip")).toBe("archive");
    expect(() => validateWorkspaceUpload("payload.exe", "application/octet-stream", 120)).toThrow("يدعم Harb");
  });

  it("limits text previews and lists safe entries from a private project archive", async () => {
    const archive = await createProjectArchive([{ path: "src/main.ts", content: "export const value = 1;" }, { path: "README.md", content: "# Project" }]);
    const result = await inspectWorkspaceBuffer("project.zip", "application/zip", archive);
    expect(result.kind).toBe("archive");
    expect(result.archiveFiles?.map(file => file.path)).toContain("src/main.ts");
    expect(workspaceUploadLimits.maxBatchFiles).toBe(8);
  });

  it("searches only safe text inside an archive and returns a bounded contextual match", async () => {
    const archive = await createProjectArchive([{ path: "src/auth.ts", content: "export function validateOwnerToken() { return true; }" }, { path: "README.md", content: "# Harb project" }]);
    const results = await searchWorkspaceArchive("project.zip", "application/zip", archive, "owner");
    expect(results).toEqual(expect.arrayContaining([expect.objectContaining({ path: "src/auth.ts", match: "content", line: 1, snippet: expect.stringContaining("validateOwnerToken") })]));
    expect(results.length).toBeLessThanOrEqual(workspaceUploadLimits.maxArchiveSearchResults);
  });
});
