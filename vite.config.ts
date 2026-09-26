// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Only used by Vercel builds: page reading and screenshot capture can take longer
// than the default function limit. Lovable's option types don't list `vercel`.
const nitro = {
  vercel: {
    functionRules: {
      "/api/read": { maxDuration: 60 },
      "/api/shot": { maxDuration: 60 },
    },
  },
} as { preset?: string };

export default defineConfig({
  nitro,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
