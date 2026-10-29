import { database, isOwner, response, jsonBody, failed } from "@/lib/waitlist-server";
export async function POST(request: Request) {
  if (!await isOwner()) return response({error:"Owner access required."},403);
  try {
    const b = await jsonBody(request);
    if (typeof b.id !== "string" || b.id.length > 64) return response({error:"Invalid request."},400);
    await database().prepare("DELETE FROM contact_requests WHERE id = ?").bind(b.id).run();
    return response({ok:true});
  } catch (error) { return failed(error); }
}
