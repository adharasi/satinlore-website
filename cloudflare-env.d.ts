declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    PUBLIC_SITE_ORIGIN?: string;
    SES_REGION?: string;
    SES_FROM_EMAIL?: string;
    FOUNDER_NOTIFICATION_EMAIL?: string;
    EMAIL_ENABLED?: string;
    WELCOME_EMAIL_ENABLED?: string;
    ADMIN_EMAIL?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    SES_ACCESS_KEY_ID?: string;
    SES_SECRET_ACCESS_KEY?: string;
    SES_SESSION_TOKEN?: string;
    SES_CONFIGURATION_SET?: string;
    ABUSE_SALT?: string;
  }
}
