import { INTERESTS, PHONES, validToken, validToyModel } from "@/lib/waitlist-validation";
import { database, failed, hash, jsonBody, response } from "@/lib/waitlist-server";
export async function POST(request: Request) {
  try {
    const b = await jsonBody(request);
    const model = validToyModel(b.model);
    if (model === null) return response({error:"Please use a short toy name, or leave it blank."}, 400);
    if (!validToken(b.token) || !(b.phone === "" || PHONES.includes(b.phone as typeof PHONES[number])) || !(b.interest === "" || INTERESTS.includes(b.interest as typeof INTERESTS[number]))) return response({error:"Please choose from the listed options."}, 400);
    const row = await database().prepare("UPDATE waitlist SET model = ?, phone = ?, interest = ? WHERE token_hash = ? AND expires_at > ? RETURNING id")
      .bind(model || null, b.phone || null, b.interest || null, await hash(b.token), Date.now()).first();
    return row ? response({ok:true}) : response({error:"This private link is invalid or has expired."}, 404);
  } catch (error) { return failed(error); }
}
