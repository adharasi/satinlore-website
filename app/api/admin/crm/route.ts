import { database, failed, isOwner, jsonBody, response } from "@/lib/waitlist-server";
import { validCrmNotes, validCrmRecordId, validCrmStage } from "@/lib/crm-validation";

export async function POST(request: Request) {
  if (!await isOwner()) return response({ error: "Owner access required." }, 403);
  try {
    const body = await jsonBody(request);
    const notes = validCrmNotes(body.notes);
    if (!validCrmRecordId(body.id) || !validCrmStage(body.stage) || notes === null) {
      return response({ error: "Choose a stage and use up to 1,000 characters for notes." }, 400);
    }
    const updatedAt = Date.now();
    // Resolve the address from a live record, never from a client-supplied email.
    // INSERT...SELECT keeps expiry checking and the contact update in one statement.
    const contact = await database().prepare("INSERT INTO crm_contacts (email, stage, notes, updated_at) SELECT email, ?, ?, ? FROM waitlist WHERE id = ? AND expires_at > ? ON CONFLICT(email) DO UPDATE SET stage = excluded.stage, notes = excluded.notes, updated_at = excluded.updated_at RETURNING stage, notes, updated_at")
      .bind(body.stage, notes, updatedAt, body.id, updatedAt).first();
    return contact ? response({ ok: true, contact }) : response({ error: "This reader’s entry has expired or been removed. Refresh the dashboard." }, 404);
  } catch (error) { return failed(error); }
}
