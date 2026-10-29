import handler from "vinext/server/fetch-handler";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const result = await handler.fetch(request, env, ctx);
    const secured = new Response(result.body, result);
    secured.headers.set("Referrer-Policy", "no-referrer");
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const path = new URL(request.url).pathname;
    if (["/api/", "/admin", "/manage", "/confirm", "/contact"].some(prefix => path.startsWith(prefix))) {
      secured.headers.set("Cache-Control", "no-store");
      secured.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return secured;
  },
};
