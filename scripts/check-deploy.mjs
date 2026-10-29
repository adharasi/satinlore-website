import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const database = config.d1_databases?.find(item => item.binding === "DB");
if (!database || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(database.database_id) || database.database_id === "00000000-0000-4000-8000-000000000000") {
  throw new Error("Create your Cloudflare D1 database first and replace database_id in wrangler.jsonc. See CLOUDFLARE_SETUP.md.");
}
console.log("Cloudflare database ID configured.");
