import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/snapmy/http";
import { validateEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

const SERVER_START_TIME = Date.now();

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { env, errors, warnings } = validateEnv();
        const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

        const groqCount = env.GROQ_API_KEYS.length;
        const jevCount = env.JEV_API_KEYS.length;

        const healthData = {
          // The studio reads `ok` to decide whether to use the server reader.
          ok: true,
          // MP4 rendering happens in the browser; there is no server render queue.
          render: { available: false },
          status: errors.length > 0 ? "degraded" : "healthy",
          timestamp: new Date().toISOString(),
          uptime_seconds: uptimeSeconds,
          version: "1.0.0",
          capabilities: {
            hasGroq: groqCount > 0,
            hasJev: jevCount > 0,
          },
          diagnostics: {
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
        };

        logger.info("Health check requested", {
          route: "/api/health",
          status: healthData.status,
          uptimeSeconds,
        });

        return json(200, healthData);
      },
    },
  },
});
