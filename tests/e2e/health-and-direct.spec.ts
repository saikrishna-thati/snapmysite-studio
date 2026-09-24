import { test, expect } from "@playwright/test";

test.describe("SnapMySite Studio Diagnostics & Direct Pipeline", () => {
  test("health check returns 200 with runtime diagnostics", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.env).toBeDefined();
    expect(body.providers).toBeDefined();
  });

  test("direct endpoint handles invalid payloads gracefully", async ({ request }) => {
    const response = await request.post("/api/direct", {
      data: { invalid: "payload" },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("missing_brief");
  });

  test("direct endpoint choreographs brief with performance metrics", async ({ request }) => {
    const response = await request.post("/api/direct", {
      data: {
        brief: {
          title: "Test Platform",
          url: "https://example.com",
          ratio: "9:16",
          durationSeconds: 12,
        },
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    expect(body.filmScript.scenes.length).toBeGreaterThanOrEqual(3);
  });
});
