import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/snapmy/http";
import { validateEnv, maskSecret } from "@/lib/env";
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
          status: errors.length > 0 ? "degraded" : "healthy",
          timestamp: new Date().toISOString(),
          uptime_seconds: uptimeSeconds,
          node_version: process.version,
          env: {
            NODE_ENV: env.NODE_ENV,
            PORT: env.PORT,
            groq_keys_configured: groqCount,
            jev_keys_configured: jevCount,
            groq_key_previews: env.GROQ_API_KEYS.map(maskSecret),
            jev_key_previews: env.JEV_API_KEYS.map(maskSecret),
          },
          providers: {
            director: groqCount > 0 ? "groq-rotational-pool" : "deterministic-choreographer",
            decisions: jevCount > 0 ? "typesafe-jev-gateway" : "verified-spatial-fallback",
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
