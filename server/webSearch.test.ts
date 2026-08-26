import { describe, expect, it } from "vitest";
import { isTrustedSourceUrl, needsTrustedSources } from "./webSearch";

describe("trusted source routing", () => {
  it("recognizes official and technical documentation domains", () => {
    expect(isTrustedSourceUrl("https://www.cisa.gov/known-exploited-vulnerabilities-catalog")).toBe(true);
    expect(isTrustedSourceUrl("https://docs.python.org/3/")).toBe(true);
    expect(isTrustedSourceUrl("https://unverified.example/blog")).toBe(false);
  });

  it("uses external references only for requests that ask for freshness or evidence", () => {
    expect(needsTrustedSources("ابحث عن مصادر موثوقة حول OWASP")).toBe(true);
    expect(needsTrustedSources("Explain this TypeScript error")).toBe(false);
  });
});
