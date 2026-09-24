/**
 * Structured server logger with secret masking and execution metrics.
 */
import { maskSecret } from "./env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  route?: string;
  requestId?: string;
  durationMs?: number;
  stage?: string;
  [key: string]: unknown;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Mask potential api keys in logs
    if (value.startsWith("gsk_") || value.startsWith("apikey_") || value.length > 32) {
      return maskSecret(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/key|secret|token|auth|password/i.test(k) && typeof v === "string") {
        res[k] = maskSecret(v);
      } else {
        res[k] = sanitizeValue(v);
      }
    }
    return res;
  }
  return value;
}

export function log(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? (sanitizeValue(context) as Record<string, unknown>) : {}),
  };

  if (error) {
    if (error instanceof Error) {
      payload["error"] = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      payload["error"] = String(error);
    }
  }

  const jsonStr = JSON.stringify(payload);
  if (level === "error") {
    console.error(jsonStr);
  } else if (level === "warn") {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext, err?: unknown) => log("warn", msg, ctx, err),
  error: (msg: string, ctx?: LogContext, err?: unknown) => log("error", msg, ctx, err),
  timer: (label: string, ctx?: LogContext) => {
    const start = performance.now();
    return (extraCtx?: LogContext) => {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      logger.info(`${label} completed`, { ...ctx, ...extraCtx, durationMs });
      return durationMs;
    };
  },
};
