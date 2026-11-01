import { database, isOwner, response, jsonBody, failed } from "@/lib/waitlist-server";
import { contactFilters, ContactFilterError, readContactInbox, updateContactStatus, validContactId, validContactStatus } from "@/lib/contact-requests";

export async function GET(request: Request) {
  if (!await isOwner()) return response({error:"Owner access required."},403);
  try {
    const inbox = await readContactInbox(database(), contactFilters(new URL(request.url).searchParams));
    return response({ok:true,...inbox});
  } catch (error) {
    if (error instanceof ContactFilterError) return response({error:error.message},400);
    return failed(error);
  }
}

export async function PATCH(request: Request) {
  if (!await isOwner()) return response({error:"Owner access required."},403);
  try {
    const body = await jsonBody(request);
    if (!validContactId(body.id) || !validContactStatus(body.status)) return response({error:"Choose a valid enquiry and status."},400);
    const updated = await updateContactStatus(database(), body.id, body.status);
    if (!updated) return response({error:"This enquiry has expired or is no longer available."},404);
    return response({ok:true,request:updated});
  } catch (error) { return failed(error); }
}

// Retain the existing owner-only deletion endpoint for established founder tools.
export async function POST(request: Request) {
  if (!await isOwner()) return response({error:"Owner access required."},403);
  try {
    const b = await jsonBody(request);
    if (!validContactId(b.id)) return response({error:"Invalid request."},400);
    await database().prepare("DELETE FROM contact_requests WHERE id = ?").bind(b.id).run();
    return response({ok:true});
  } catch (error) { return failed(error); }
}
