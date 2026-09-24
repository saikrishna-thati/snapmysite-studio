import { createFileRoute } from "@tanstack/react-router";
import { apiError, json, readJsonBody } from "@/lib/snapmy/http";
import { directWebsite } from "@/lib/snapmy/director";

export const Route = createFileRoute("/api/direct")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await readJsonBody(request);
        } catch (cause) {
          const err = cause as Error & { code?: string };
          return apiError(400, err.code || "invalid_body", err.message);
        }
        if (!body["brief"] || typeof body["brief"] !== "object" || Array.isArray(body["brief"])) {
          return apiError(400, "missing_brief", "A structured website brief is required.");
        }
        try {
          const result = await directWebsite(body["brief"] as Parameters<typeof directWebsite>[0]);
          return json(200, { ok: true, ...result });
        } catch {
          return apiError(500, "direct_failed", "The creative director could not produce a direction.");
        }
      },
    },
  },
});
