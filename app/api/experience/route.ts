import { database, runtime, response } from "@/lib/waitlist-server";
import { ExperienceError, experienceSameOrigin, readExperienceJson, writeExperience } from "@/lib/website-experience";

export async function POST(request: Request) {
  if (!experienceSameOrigin(request, runtime().PUBLIC_SITE_ORIGIN)) return response({ error: "Use the privacy controls on the SatinLore website." }, 403);
  try { return response(await writeExperience(database(), request, await readExperienceJson(request), runtime().ABUSE_SALT)); }
  catch (error) {
    if (error instanceof ExperienceError) return response({ error: error.message }, error.status);
    return response({ error: "Activity recording is unavailable. The website still works normally." }, 503);
  }
}
