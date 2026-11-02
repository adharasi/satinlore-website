import { database, isOwner, response } from "@/lib/waitlist-server";
import { ExperienceError, validExperienceId, experienceFilters, readExperienceOverview, readExperienceDetail, deleteExperienceSession, experienceSameOrigin, readExperienceJson } from "@/lib/website-experience";

export async function GET(request: Request) {
  if (!await isOwner()) return response({ error: "Owner access required." }, 403);
  try {
    const params = new URL(request.url).searchParams, id = params.get("id");
    return response({ ok: true, ...(id ? await readExperienceDetail(database(), id) : await readExperienceOverview(database(), experienceFilters(params))) });
  } catch (error) {
    if (error instanceof ExperienceError) return response({ error: error.message }, error.status);
    return response({ error: "Website recordings could not be loaded." }, 503);
  }
}
export async function DELETE(request: Request) {
  if (!await isOwner()) return response({ error: "Owner access required." }, 403);
  if (!experienceSameOrigin(request)) return response({ error: "Use the SatinLore admin controls." }, 403);
  try {
    const body = await readExperienceJson(request);
    if (Object.keys(body).length !== 1 || !validExperienceId(body.id)) throw new ExperienceError("Choose one recording to delete.");
    return response({ ok: true, ...await deleteExperienceSession(database(), body.id) });
  } catch (error) {
    if (error instanceof ExperienceError) return response({ error: error.message }, error.status);
    return response({ error: "This recording could not be deleted." }, 503);
  }
}
