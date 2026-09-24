import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/snapmy/http";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const jevConfigured = Boolean(typeof process.env['JEV_KEY'] === "string" && process.env['JEV_KEY'].trim());
        const groqRaw = [
          process.env['GROQ_KEYS'],
          process.env['GROQ_KEY'],
          process.env['DIRECTOR_KEY'],
          process.env['GROQ_KEY_1'],
          process.env['GROQ_KEY_2'],
          process.env['GROQ_KEY_3'],
          process.env['GROQ_KEY_4'],
          process.env['GROQ_KEY_5'],
          process.env['GROQ_KEY_6'],
        ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
        const groqKeyCount = new Set(groqRaw.flatMap((value) => value.trim().split(/[\s,]+/)).filter(Boolean)).size;
        const groqConfigured = groqKeyCount > 0;
        const director = groqConfigured
          ? { provider: "groq", model: (typeof process.env['GROQ_MODEL'] === "string" && process.env['GROQ_MODEL'].trim()) || "openai/gpt-oss-120b", keys: groqKeyCount }
          : null;
        return json(200, {
          ok: true,
          version: "1.0.0",
          providers: { reader: jevConfigured ? "configured" : "direct-html", decisions: process.env['LOVABLE_API_KEY'] ? { provider: "jev", model: "typesafe/jev-latest" } : "deterministic-fallback", director: director || "deterministic-fallback", order: ["decisions", "director"] },
          render: { available: false, mode: "diagnostic", reason: "No server-side browser and FFmpeg render worker is configured." },
        });
      },
    },
  },
});
