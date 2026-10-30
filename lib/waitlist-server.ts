import { purgeExpiredRecords } from "@/lib/data-retention";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { verifyAdminRequest } from "@/lib/admin-auth";

type AppEnv = { QUESTIONNAIRE_WEBHOOK_SECRET?: string; SURVEY_EMAIL_ENABLED?: string; PUBLIC_SITE_ORIGIN?: string; DB?: D1Database; ADMIN_EMAIL?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; ABUSE_SALT?: string; SES_ACCESS_KEY_ID?: string; SES_SECRET_ACCESS_KEY?: string; SES_SESSION_TOKEN?: string; SES_REGION?: string; SES_FROM_EMAIL?: string; SES_CONFIGURATION_SET?: string; EMAIL_ENABLED?: string; WELCOME_EMAIL_ENABLED?: string; FOUNDER_NOTIFICATION_EMAIL?: string };
export const runtime = () => env as unknown as AppEnv;
export function database(): D1Database {
  const db = runtime().DB;
  if (!db) throw new Error("Database unavailable");
  return db;
}
export function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export async function jsonBody(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new Error("origin");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("content");
  if (Number(request.headers.get("content-length") || 0) > 6000) throw new Error("size");
  const text = await request.text();
  if (text.length > 6000) throw new Error("size");
  const body = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("body");
  return body as Record<string, unknown>;
}
export async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}
export async function cleanExpired() {
  await purgeExpiredRecords(database());
}
export async function rateLimit(request: Request) {
  const ABUSE_SALT = runtime().ABUSE_SALT || (import.meta.env.DEV ? "local-preview-not-for-production" : undefined);
  if (!ABUSE_SALT) throw new Error("Rate limiter unavailable");
  const window = Math.floor(Date.now() / 3600000);
  const address = request.headers.get("cf-connecting-ip") || "local-preview";
  const key = await hash(ABUSE_SALT + ":" + address + ":" + window);
  const row = await database().prepare("INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(key, Date.now() + 7200000).first<{ count: number }>();
  return (row?.count || 0) <= 12;
}
export async function emailRateLimit(email: string) {
  const salt = runtime().ABUSE_SALT || (import.meta.env.DEV ? "local-preview-not-for-production" : undefined);
  if (!salt) throw new Error("Rate limiter unavailable");
  const key = await hash(salt + ":email:" + email + ":" + Math.floor(Date.now() / 86400000));
  const row = await database().prepare("INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(key, Date.now() + 86400000).first<{count:number}>();
  return (row?.count || 0) <= 3;
}
export async function isOwner() {
  return !!await verifyAdminRequest(await headers(), runtime());
}
export function failed(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (["origin", "content", "size", "body"].includes(message) || error instanceof SyntaxError) {
    return response({ error: "Please submit this form from the Satinlore website." }, 400);
  }
  return response({ error: "We couldn’t save this just now. Please try again shortly." }, 503);
}
