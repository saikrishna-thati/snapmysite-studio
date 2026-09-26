import { createFileRoute } from "@tanstack/react-router";
import { apiError, json, readJsonBody } from "@/lib/snapmy/http";
import { readWebsite } from "@/lib/snapmy/site";
import { logger } from "@/lib/logger";

/** Reads a website into the studio brief: copy, pages, brand kit and screenshot evidence. */
export const Route = createFileRoute("/api/read")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID();
        const endTimer = logger.timer("POST /api/read", { route: "/api/read", requestId });

        let body: Record<string, unknown>;
        try {
          body = await readJsonBody(request);
        } catch (cause) {
          const err = cause as Error & { code?: string };
          return apiError(400, err.code || "invalid_body", err.message);
        }
        if (typeof body["url"] !== "string" || !body["url"].trim()) {
          return apiError(400, "missing_url", "A website URL is required.");
        }

        try {
          const raw = body["url"].trim();
          const target = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
          const brief = await readWebsite(target, {
            maxPages: 4,
            shotOrigin: new URL(request.url).origin,
          });
          const durationMs = endTimer({ pages: brief.pages.length, name: brief.name });
          return json(200, { ok: true, requestId, durationMs, brief });
        } catch (cause) {
          const err = cause as Error & { code?: string };
          const clientError = ["invalid_url", "blocked_url"].includes(err.code || "");
          logger.warn("Website read failed", { requestId, code: err.code, error: err.message });
          return apiError(
            clientError ? 400 : 502,
            err.code || "read_failed",
            err.message || "The website could not be read.",
          );
        }
      },
    },
  },
});
