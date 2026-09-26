import { createFileRoute } from "@tanstack/react-router";
import { safeUrl, thumUrl } from "@/lib/snapmy/capture.server";
import { logger } from "@/lib/logger";

/** Streams a page screenshot from thum.io same-origin, so the player and exports can use it. */
export const Route = createFileRoute("/api/shot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const width = Math.max(320, Math.min(2000, Number(params.get("w")) || 1440));
        const height = Math.max(320, Math.min(2000, Number(params.get("h")) || 900));
        const full = params.get("full") === "1";

        let target: URL;
        try {
          target = safeUrl(params.get("url") ?? "");
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Bad url", { status: 400 });
        }

        const src = thumUrl({ url: target.toString(), width, height, full });
        // Two attempts inside a bounded budget. Failures are never cached.
        let timedOut = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 20000);
          try {
            const res = await fetch(src, { signal: ctrl.signal, redirect: "follow" });
            const type = res.headers.get("content-type") ?? "";
            if (res.ok && res.body && type.startsWith("image/")) {
              const image = await res.arrayBuffer();
              if (image.byteLength > 0) {
                return new Response(image, {
                  status: 200,
                  headers: {
                    "content-type": type,
                    "cache-control": "public, max-age=3600, s-maxage=86400",
                    "access-control-allow-origin": "*",
                  },
                });
              }
            } else {
              await res.body?.cancel();
            }
            logger.warn("Screenshot provider rejected capture", {
              attempt: attempt + 1,
              status: res.status,
              contentType: type,
            });
          } catch {
            timedOut = ctrl.signal.aborted;
            logger.warn("Screenshot provider request failed", { attempt: attempt + 1, timedOut });
          } finally {
            clearTimeout(timer);
          }
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 750));
        }
        return new Response("The screenshot service is temporarily unavailable. Please retry.", {
          status: timedOut ? 504 : 502,
          headers: { "x-capture": "failed", "cache-control": "no-store", "retry-after": "5" },
        });
      },
    },
  },
});
