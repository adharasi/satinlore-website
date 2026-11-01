export const CONTACT_CATEGORIES = ["question", "partner", "privacy", "delete"] as const;
export const CONTACT_STATUSES = ["new", "read", "in_progress", "resolved"] as const;
export type ContactCategory = typeof CONTACT_CATEGORIES[number];
export type ContactStatus = typeof CONTACT_STATUSES[number];
export type ContactRequest = {
  id: string; email: string; category: ContactCategory; message: string;
  status: ContactStatus; created_at: number; updated_at: number | null; related_count: number;
};
export type ContactInbox = {
  requests: ContactRequest[]; total: number; page: number; pageSize: number;
  hasMore: boolean; counts: Record<ContactStatus, number>;
};
export type ContactFilters = {
  q: string; category: ContactCategory | "all"; status: ContactStatus | "all";
  sort: "newest" | "oldest"; page: number; pageSize: number;
};

export class ContactFilterError extends Error {}
export function validContactId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}
export function validContactStatus(value: unknown): value is ContactStatus {
  return typeof value === "string" && CONTACT_STATUSES.includes(value as ContactStatus);
}
function positiveInteger(raw: string | null, fallback: number, maximum: number) {
  if (raw === null || raw === "") return fallback;
  if (!/^\d{1,6}$/.test(raw)) throw new ContactFilterError("Choose a valid page size or page number.");
  const value = Number(raw);
  if (value < 1 || value > maximum) throw new ContactFilterError("Choose a valid page size or page number.");
  return value;
}
export function contactFilters(params: URLSearchParams): ContactFilters {
  const q = (params.get("q") || "").normalize("NFC").trim();
  const category = params.get("category") || "all";
  const status = params.get("status") || "all";
  const sort = params.get("sort") || "newest";
  if (q.length > 120 || /[\u0000-\u001f\u007f-\u009f]/u.test(q)) throw new ContactFilterError("Keep the search to 120 characters.");
  if (category !== "all" && !CONTACT_CATEGORIES.includes(category as ContactCategory)) throw new ContactFilterError("Choose a valid enquiry category.");
  if (status !== "all" && !validContactStatus(status)) throw new ContactFilterError("Choose a valid enquiry status.");
  if (sort !== "newest" && sort !== "oldest") throw new ContactFilterError("Choose newest or oldest first.");
  return { q, category: category as ContactFilters["category"], status: status as ContactFilters["status"], sort,
    page: positiveInteger(params.get("page"), 1, 10000), pageSize: positiveInteger(params.get("limit"), 50, 100) };
}

/** Parameter-bound search: SQL wildcards typed by the founder are literal text. */
export function contactQuery(filters: ContactFilters, now: number) {
  const conditions = ["c.expires_at > ?"];
  const values: (string | number)[] = [now];
  if (filters.q) {
    conditions.push("(c.email LIKE ? ESCAPE '\\' OR c.message LIKE ? ESCAPE '\\')");
    const literal = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    values.push(literal, literal);
  }
  if (filters.category !== "all") { conditions.push("c.category = ?"); values.push(filters.category); }
  if (filters.status !== "all") { conditions.push("c.status = ?"); values.push(filters.status); }
  const where = conditions.join(" AND ");
  const direction = filters.sort === "oldest" ? "ASC" : "DESC";
  return {
    rows: `SELECT c.id,c.email,c.category,c.message,c.status,c.created_at,c.updated_at,
      (SELECT COUNT(*) FROM contact_requests related WHERE related.email=c.email AND related.expires_at > ?) related_count
      FROM contact_requests c WHERE ${where} ORDER BY c.created_at ${direction},c.id ${direction} LIMIT ? OFFSET ?`,
    rowValues: [now, ...values, filters.pageSize, (filters.page - 1) * filters.pageSize],
    count: `SELECT COUNT(*) total FROM contact_requests c WHERE ${where}`,
    countValues: values,
  };
}
export async function readContactInbox(db: D1Database, filters: ContactFilters, now = Date.now()): Promise<ContactInbox> {
  const query = contactQuery(filters, now);
  const [rows, total, grouped] = await Promise.all([
    db.prepare(query.rows).bind(...query.rowValues).all<ContactRequest>(),
    db.prepare(query.count).bind(...query.countValues).first<{ total: number }>(),
    db.prepare("SELECT status,COUNT(*) total FROM contact_requests WHERE expires_at > ? GROUP BY status").bind(now).all<{ status: ContactStatus; total: number }>(),
  ]);
  const counts: ContactInbox["counts"] = { new: 0, read: 0, in_progress: 0, resolved: 0 };
  for (const group of grouped.results) if (validContactStatus(group.status)) counts[group.status] = Number(group.total);
  return { requests: rows.results, total: Number(total?.total || 0), page: filters.page, pageSize: filters.pageSize,
    hasMore: filters.page * filters.pageSize < Number(total?.total || 0), counts };
}

export async function updateContactStatus(db: D1Database, id: string, status: ContactStatus, now = Date.now()) {
  return db.prepare("UPDATE contact_requests SET status = ?,updated_at = ? WHERE id = ? AND expires_at > ? RETURNING id,status,updated_at")
    .bind(status, now, id, now).first<{ id: string; status: ContactStatus; updated_at: number }>();
}
