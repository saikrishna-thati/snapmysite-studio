import { createFileRoute } from "@tanstack/react-router";
import { apiError, json, readJsonBody } from "@/lib/snapmy/http";
import { directWebsite } from "@/lib/snapmy/director";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/api/direct")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID();
        const endTimer = logger.timer("POST /api/direct", { route: "/api/direct", requestId });

        let body: Record<string, unknown>;
        try {
          body = await readJsonBody(request);
        } catch (cause) {
          const err = cause as Error & { code?: string };
          logger.warn("Invalid request body received at /api/direct", {
            requestId,
            error: err.message,
          });
          return apiError(400, err.code || "invalid_body", err.message);
        }

        if (!body["brief"] || typeof body["brief"] !== "object" || Array.isArray(body["brief"])) {
          logger.warn("Missing brief parameter in /api/direct payload", { requestId });
          return apiError(400, "missing_brief", "A structured website brief is required.");
        }

        try {
          const result = await directWebsite(body["brief"] as Parameters<typeof directWebsite>[0]);
          const durationMs = endTimer({
            sceneCount: result.filmScript.scenes.length,
            title: result.brief.title,
            ratio: result.brief.ratio,
          });

          return json(200, {
            ok: true,
            requestId,
            durationMs,
            ...result,
          });
        } catch (error) {
          logger.error("Creative director pipeline failure", { requestId }, error);
          return apiError(
            500,
            "direct_failed",
            "The creative director could not produce a direction.",
          );
        }
      },
    },
  },
});
