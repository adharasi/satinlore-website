import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Create your D1 database and configure the `DB` binding and database_id in wrangler.jsonc before deployment."
    );
  }

  return drizzle(env.DB, { schema });
}
