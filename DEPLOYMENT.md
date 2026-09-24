# SnapMySite Studio — Vercel Deployment & Environment Checklist

This guide outlines production deployment on Vercel, key rotations, and monitoring health checks.

---

## 1. Required Production Environment Variables

Configure these in **Vercel Dashboard > Project Settings > Environment Variables** for **Production** and **Preview** environments:

| Variable        | Description                                                                       | Example / Format             |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| `GROQ_API_KEYS` | Comma-separated Groq API keys for key-cycling failover and rate-limit recovery.   | `gsk_key1,gsk_key2,gsk_key3` |
| `JEV_API_KEYS`  | Comma-separated TypeSafe JEV keys for verified element semantics and decisioning. | `apikey_jev1,apikey_jev2`    |
| `NODE_ENV`      | Runtime environment.                                                              | `production`                 |
| `PORT`          | Listening server port.                                                            | `3000`                       |

---

## 2. Vercel Project Build Configuration

- **Framework Preset**: `Vite`
- **Root Directory**: `./`
- **Build Command**: `bun run build`
- **Install Command**: `bun install`
- **Output Directory**: `dist/client`

These settings are pre-configured in `vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "bun run build",
  "installCommand": "bun install",
  "outputDirectory": "dist/client"
}
```

---

## 3. Post-Deployment Verification Checklist

1. **Health & Provider Check:**
   - Query `https://your-domain.vercel.app/api/health`
   - Verify `status: "healthy"`
   - Confirm `groq_keys_configured` and `jev_keys_configured` match configured keys.
   - Verify key previews are masked (e.g., `gsk_1234...cdef`).

2. **Pipeline Test:**
   - Send test POST request to `/api/direct` with brief payload.
   - Confirm response includes `ok: true`, generated scenes, and `durationMs` timing metrics.

3. **Performance Metrics & Client Verification:**
   - Open `/studio` in browser.
   - Verify showcase reels render and pause off-screen without frame runaway.
   - Open console and inspect `window.__SNAPMY_METRICS.getSummary()` for average FPS and dropped frames.
   - Inspect `window.snapmyAudio.getMetrics()` for Web Audio initialization and synthesis timings.

---

## 4. Secret Safety & Key Rotation

- Never commit `.env` or raw keys to Git.
- If a Groq or JEV key is revoked, add the replacement key to the comma-separated `GROQ_API_KEYS` or `JEV_API_KEYS` list in Vercel.
- Redaction utilities in `src/lib/env.ts` and `src/lib/logger.ts` mask keys in logs, health checks, and error reports automatically.
