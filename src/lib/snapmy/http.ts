export function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { ok: false, error: message, code, ...extra });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { code: "invalid_json" });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw Object.assign(new Error("Request body must be a JSON object."), { code: "invalid_body" });
  }
  return parsed as Record<string, unknown>;
}
