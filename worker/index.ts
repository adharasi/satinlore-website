import { purgeExpiredRecords } from "../lib/data-retention";
import handler from "vinext/server/fetch-handler";
import { processSurveyEmailJobs } from "../lib/survey-email-jobs";
import { trackPageView } from "../lib/site-analytics";

export default {
  async scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const surveyEnabled = (env as Cloudflare.Env & { SURVEY_EMAIL_ENABLED?: string }).SURVEY_EMAIL_ENABLED === "true";
    ctx.waitUntil((async () => {
      await purgeExpiredRecords(env.DB);
      return processSurveyEmailJobs(env.DB, {
      enabled: env.EMAIL_ENABLED === "true",
      welcomeEnabled: false,
      region: env.SES_REGION || "eu-north-1",
      accessKeyId: env.SES_ACCESS_KEY_ID || "",
      secretAccessKey: env.SES_SECRET_ACCESS_KEY || "",
      sessionToken: env.SES_SESSION_TOKEN,
      fromEmail: env.SES_FROM_EMAIL || "",
      publicOrigin: env.PUBLIC_SITE_ORIGIN || "https://satinlore.com",
      configurationSet: env.SES_CONFIGURATION_SET,
    }, { enabled: surveyEnabled, tokenSecret: env.ABUSE_SALT || "" });
    })());
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const result = await handler.fetch(request, env, ctx);
    ctx.waitUntil(trackPageView(env.DB, request, result, env.ABUSE_SALT).catch(() => undefined));
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
