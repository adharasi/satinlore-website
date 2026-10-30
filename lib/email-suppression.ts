/** Durable marketing opt-outs. A keyed digest avoids keeping raw addresses in this table. */
export async function marketingSuppressionHash(email: string, salt: string | undefined): Promise<string> {
  if (!salt || salt.length < 16) throw new Error("Email suppression is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`email-suppression:${email.trim().toLowerCase()}`));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
}

export async function withMarketingSuppression<T extends { email: string }>(db: D1Database, contacts: T[], salt: string | undefined): Promise<(T & { marketing_suppressed: boolean })[]> {
  if (!contacts.length) return [];
  const hashes = await Promise.all(contacts.map(contact => marketingSuppressionHash(contact.email, salt)));
  const unique = [...new Set(hashes)];
  const suppressed = new Set<string>();
  // Keep well below D1's maximum bound parameters, including the purpose parameter.
  for (let offset = 0; offset < unique.length; offset += 90) {
    const chunk = unique.slice(offset, offset + 90);
    const rows = await db.prepare(`SELECT email_hash FROM email_suppressions WHERE purpose=? AND email_hash IN (${chunk.map(() => "?").join(",")})`).bind("marketing", ...chunk).all<{ email_hash: string }>();
    for (const row of rows.results) suppressed.add(row.email_hash);
  }
  return contacts.map((contact, index) => ({ ...contact, marketing_suppressed: suppressed.has(hashes[index]) }));
}
