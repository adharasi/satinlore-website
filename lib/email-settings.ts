import { runtime } from "@/lib/waitlist-server";
import { emailPublicOrigin } from "@/lib/email-content";
import type { EmailSettings } from "@/lib/email-sender";

// Email links use the operator-configured origin, never an untrusted Host header.
export function emailSettings(_requestOrigin?: string): EmailSettings {
  const e = runtime();
  const publicOrigin = emailPublicOrigin(e.PUBLIC_SITE_ORIGIN || "https://satinlore.com");
  return {
    enabled: e.EMAIL_ENABLED === "true",
    welcomeEnabled: e.WELCOME_EMAIL_ENABLED === "true",
    founderNotificationEmail: e.FOUNDER_NOTIFICATION_EMAIL || "team@satinlore.com",
    region: e.SES_REGION || "eu-north-1",
    accessKeyId: e.SES_ACCESS_KEY_ID || "",
    secretAccessKey: e.SES_SECRET_ACCESS_KEY || "",
    sessionToken: e.SES_SESSION_TOKEN,
    fromEmail: e.SES_FROM_EMAIL || "",
    publicOrigin,
    configurationSet: e.SES_CONFIGURATION_SET,
  };
}
