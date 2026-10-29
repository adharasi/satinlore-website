import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AdminAuthSettings = {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAIL?: string;
};
export type AdminUser = { userId: string; email: string };

// Only the configured Cloudflare team can supply signing keys. Neither a token's
// unverified issuer nor request headers can choose a remote key URL.
const signingKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/;

export function adminAuthConfiguration(settings: AdminAuthSettings) {
  const team = settings.ACCESS_TEAM_DOMAIN?.trim().toLowerCase();
  const audience = settings.ACCESS_AUD?.trim();
  const email = settings.ADMIN_EMAIL?.trim().toLowerCase();
  if (!team || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(team)) return null;
  if (!audience || !/^[a-zA-Z0-9_-]{1,256}$/.test(audience)) return null;
  if (!email || email.length > 254 || !EMAIL.test(email)) return null;
  return { issuer: `https://${team}`, audience, email };
}

/** A missing or invalid token always denies access, including workers.dev URLs. */
export async function verifyAdminRequest(
  headers: Pick<Headers, "get">,
  settings: AdminAuthSettings,
  keyResolver?: JWTVerifyGetKey,
): Promise<AdminUser | null> {
  const config = adminAuthConfiguration(settings);
  const token = headers.get("Cf-Access-Jwt-Assertion");
  if (!config || !token || token.length > 16_384) return null;
  try {
    let keys = keyResolver;
    if (!keys) {
      let remote = signingKeys.get(config.issuer);
      if (!remote) {
        remote = createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`), {
          timeoutDuration: 5_000,
          cooldownDuration: 30_000,
          cacheMaxAge: 10 * 60_000,
        });
        if (signingKeys.size >= 16) signingKeys.clear();
        signingKeys.set(config.issuer, remote);
      }
      keys = remote;
    }
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.audience,
      requiredClaims: ["exp", "iat", "sub", "email"],
    });
    // Access application tokens represent the signed-in person; service/global
    // tokens and an allowlisted address in a plain header are not a login.
    if (payload.type !== "app" || typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.email !== "string" || !EMAIL.test(payload.email)) return null;
    const email = payload.email.toLowerCase();
    if (email !== config.email) return null;
    return { userId: payload.sub, email };
  } catch {
    // Avoid returning JWT contents, verification details, or account data.
    return null;
  }
}
