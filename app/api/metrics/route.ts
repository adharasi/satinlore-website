import { analyticsRateLimit, ctaMetric, measurementAllowed, recordMetric } from "@/lib/site-analytics";
import { database, runtime, response } from "@/lib/waitlist-server";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response({ error: "Invalid measurement request." }, 400);
  if (!measurementAllowed(request)) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") || 0) > 1024) return response({ error: "Invalid measurement request." }, 400);
    const reader = request.body?.getReader();
    if (!reader) return response({ error: "Invalid measurement request." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return response({ error: "Invalid measurement request." }, 400); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return response({ error: "Invalid measurement request." }, 400); }
  const metric = ctaMetric(request, body);
  if (!metric) return response({ error: "Invalid measurement request." }, 400);
  try {
    if (!await analyticsRateLimit(database(), request, runtime().ABUSE_SALT, "cta")) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    await recordMetric(database(), metric);
  } catch {
    // A failed counter must never interrupt the CTA, signup or public page.
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
