const READER_ORIGIN = "https://app.satinlore.com";

export const READER_SIGNUP_URL = READER_ORIGIN + "/signup";
export const READER_LOGIN_URL = READER_ORIGIN + "/login";
export const READER_BILLING_URL = READER_ORIGIN + "/billing";

export function marketingLaunch(env: { MARKETING_LAUNCH_ENABLED?: string; MARKETING_BILLING_ENABLED?: string }) {
  const launch = env.MARKETING_LAUNCH_ENABLED === "true";
  return { launch, billing: launch && env.MARKETING_BILLING_ENABLED === "true" };
}
