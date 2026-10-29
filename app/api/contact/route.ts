import { validEmail } from "@/lib/waitlist-validation";
import { cleanExpired, database, failed, jsonBody, rateLimit, response } from "@/lib/waitlist-server";
export async function POST(request: Request) {
  try {
    const b = await jsonBody(request);
    if (b.company) return response({ok:true});
    const email = validEmail(b.email);
    const categories = ["question", "privacy", "delete", "partner"];
    if (!email || typeof b.category !== "string" || !categories.includes(b.category) || typeof b.message !== "string" || b.message.trim().length < 5 || b.message.length > 1000 || b.consent !== true) return response({error:"Please enter a valid email, a short message and your agreement to process this enquiry."}, 400);
    await cleanExpired();
    if (!await rateLimit(request)) return response({error:"Too many attempts. Please try again in an hour."}, 429);
    const now = Date.now();
    await database().prepare("INSERT INTO contact_requests (id, email, category, message, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), email, b.category, b.message.trim(), now, now + 30 * 86400000).run();
    return response({ok:true});
  } catch (error) { return failed(error); }
}
