import { describe, expect, it } from "vitest";

describe("SerpApi search credential", () => {
  it("authenticates against the free account endpoint without exposing the key", async () => {
    const apiKey = process.env.SERPAPI_API_KEY;
    expect(apiKey).toBeTruthy();

    const url = new URL("https://serpapi.com/account.json");
    url.searchParams.set("api_key", apiKey!);
    const response = await fetch(url);

    expect(response.status).toBe(200);
    const body = await response.json() as { account_id?: string; account_status?: string };
    expect(body.account_id).toBeTruthy();
    expect(body.account_status).toBeTruthy();
  }, 15_000);
});
