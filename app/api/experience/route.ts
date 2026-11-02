import { database, runtime, response } from "@/lib/waitlist-server";
import { ExperienceError, EXPERIENCE_VISUAL_BODY_BYTES, EXPERIENCE_BODY_BYTES, experienceSameOrigin, readExperienceJson, writeExperience } from "@/lib/website-experience";

export async function POST(request: Request) {
  if (!experienceSameOrigin(request, runtime().PUBLIC_SITE_ORIGIN)) return response({ error: "Use the privacy controls on the SatinLore website." }, 403);
  try {
    // A non-simple header selects the independently bounded visual upload body.
    // Exact Origin was checked first; the action and format are validated below.
    const maxBytes = request.headers.get("x-satinlore-replay") === "rrweb-v1" ? EXPERIENCE_VISUAL_BODY_BYTES : EXPERIENCE_BODY_BYTES;
    return response(await writeExperience(database(), request, await readExperienceJson(request, maxBytes), runtime().ABUSE_SALT));
  }
  catch (error) {
    if (error instanceof ExperienceError) return response({ error: error.message }, error.status);
    return response({ error: "Activity recording is unavailable. The website still works normally." }, 503);
  }
}
