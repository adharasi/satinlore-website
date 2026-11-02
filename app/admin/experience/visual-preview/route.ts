import { isOwner, response } from "@/lib/waitlist-server";
import { visualReplayShellResponse } from "@/lib/visual-replay-shell";

export async function GET() {
  if (!await isOwner()) return response({ error: "Owner access required." }, 403);
  return visualReplayShellResponse();
}
