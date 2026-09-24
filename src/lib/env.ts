/**
 * Runtime environment configuration, validation, and secret masking.
 */

export interface AppEnv {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  GROQ_API_KEYS: string[];
  JEV_API_KEYS: string[];
}

/**
 * Mask sensitive credentials for logging and diagnostics.
 * e.g., "gsk_1234567890abcdef" -> "gsk_1234...cdef"
 */
export function maskSecret(secret: string | undefined | null): string {
  if (!secret) return "[NOT_SET]";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "***";
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}...${end}`;
}

export function parseKeyList(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function validateEnv(strict = false): {
  env: AppEnv;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawNodeEnv = process.env["NODE_ENV"] || "development";
  const validNodeEnvs = ["development", "production", "test"] as const;
  const nodeEnv = (
    validNodeEnvs.includes(rawNodeEnv as (typeof validNodeEnvs)[number])
      ? rawNodeEnv
      : "development"
  ) as AppEnv["NODE_ENV"];

  const rawPort = process.env["PORT"] || "3000";
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`Invalid PORT configuration: "${rawPort}". Must be a number between 1 and 65535.`);
  }

  // Parse Groq Keys
  const groqRaw = [
    process.env["GROQ_API_KEYS"],
    process.env["GROQ_KEYS"],
    process.env["GROQ_API_KEY"],
    process.env["GROQ_KEY"],
  ]
    .filter(Boolean)
    .join(",");
  const groqKeys = Array.from(new Set(parseKeyList(groqRaw)));

  if (groqKeys.length === 0) {
    const msg =
      "Missing GROQ_API_KEYS environment variable. Choreography will operate in deterministic fallback mode.";
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  // Parse JEV Keys
  const jevRaw = [
    process.env["JEV_API_KEYS"],
    process.env["JEV_KEYS"],
    process.env["JEV_API_KEY"],
    process.env["JEV_KEY"],
  ]
    .filter(Boolean)
    .join(",");
  const jevKeys = Array.from(new Set(parseKeyList(jevRaw)));

  if (jevKeys.length === 0) {
    const msg =
      "Missing JEV_API_KEYS environment variable. Semantic decisions will operate in verified fallback mode.";
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  const env: AppEnv = {
    NODE_ENV: nodeEnv,
    PORT: isNaN(port) ? 3000 : port,
    GROQ_API_KEYS: groqKeys,
    JEV_API_KEYS: jevKeys,
  };

  return { env, errors, warnings };
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    const { env, errors, warnings } = validateEnv();
    if (errors.length > 0) {
      console.error("[ENV VALIDATION ERROR]", errors.join(" | "));
    }
    if (warnings.length > 0 && process.env["NODE_ENV"] !== "test") {
      console.warn("[ENV CONFIG WARNING]", warnings.join(" | "));
    }
    cachedEnv = env;
  }
  return cachedEnv;
}
