import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = fileURLToPath(new URL("../dist/server/wrangler.json", import.meta.url));
if (!existsSync(config)) throw new Error("Run pnpm build before pnpm start.");
const localSecrets = fileURLToPath(new URL("../.dev.vars", import.meta.url));
const cli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const args = [cli, "dev", "--config", config, "--local", "--persist-to", ".wrangler/state",
  ...(existsSync(localSecrets) ? ["--env-file", localSecrets] : []), ...process.argv.slice(2)];
const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: process.env });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
