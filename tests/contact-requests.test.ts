import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const contacts = await import(new URL("../lib/contact-requests.ts", import.meta.url).href);
const { contactFilters, readContactInbox, updateContactStatus, ContactFilterError } = contacts;
const now = Date.UTC(2026, 10, 1, 12);

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE contact_requests(id TEXT PRIMARY KEY,email TEXT NOT NULL,category TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'new',updated_at INTEGER);
    CREATE INDEX contact_requests_email_created_idx ON contact_requests(email,created_at);
    CREATE INDEX contact_requests_status_created_idx ON contact_requests(status,created_at);`);
  let prepares = 0;
  const db = {
    prepare(sql: string) {
      prepares++;
      const statement = sqlite.prepare(sql); let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) { values = args; return this; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values), success: true }; },
        async run() { const result = statement.run(...values); return { success: true, meta: { changes: result.changes } }; },
      };
    },
  } as unknown as D1Database;
  function add(id: string, email: string, category = "question", message = "A synthetic question", created = now - 5000, expires = now + 100000, status = "new") {
    sqlite.prepare("INSERT INTO contact_requests(id,email,category,message,created_at,expires_at,status) VALUES(?,?,?,?,?,?,?)").run(id,email,category,message,created,expires,status);
  }
  return { sqlite, db, add, prepares: () => prepares };
}
function filters(query = "") { return contactFilters(new URLSearchParams(query)); }

test("contact inbox filters validate bounds and reject unknown categories or statuses", () => {
  assert.deepEqual(filters(), { q: "", category: "all", status: "all", sort: "newest", page: 1, pageSize: 50 });
  assert.equal(filters("q=+Reader%40Example.Test+&category=privacy&status=in_progress&sort=oldest&page=2&limit=100").q, "Reader@Example.Test");
  for (const query of ["category=arbitrary", "status=blocked", "sort=random()", "page=0", "page=10001", "limit=101", "limit=-1", "q=%00", `q=${"x".repeat(121)}`]) {
    assert.throws(() => filters(query), ContactFilterError, query);
  }
});

test("contact inbox groups notes by normalized email, filters expired notes, and paginates stably", async t => {
  const f = fixture(); t.after(() => f.sqlite.close());
  f.add("note_a", "reader@example.test", "question", "Earlier note", now - 5000);
  f.add("note_b", "reader@example.test", "privacy", "Later note", now - 1000, now + 100000, "read");
  f.add("note_c", "other@example.test", "partner", "Partner note", now - 3000);
  f.add("note_d", "reader@example.test", "delete", "Expired note", now - 500, now);
  const page1 = await readContactInbox(f.db, filters("limit=2"), now);
  assert.deepEqual(page1.requests.map((r: { id: string }) => r.id), ["note_b", "note_c"]);
  assert.equal(page1.requests[0].related_count, 2);
  assert.equal(page1.total, 3); assert.equal(page1.hasMore, true);
  assert.deepEqual(page1.counts, { new: 2, read: 1, in_progress: 0, resolved: 0 });
  const page2 = await readContactInbox(f.db, filters("limit=2&page=2"), now);
  assert.deepEqual(page2.requests.map((r: { id: string }) => r.id), ["note_a"]); assert.equal(page2.hasMore, false);
  const oldest = await readContactInbox(f.db, filters("sort=oldest&category=question&status=new"), now);
  assert.deepEqual(oldest.requests.map((r: { id: string }) => r.id), ["note_a"]);
  const search = await readContactInbox(f.db, filters("q=READER%40EXAMPLE.TEST"), now);
  assert.equal(search.total, 2);
});

test("search binds email and message text and treats SQL syntax and LIKE wildcards literally", async t => {
  const f = fixture(); t.after(() => f.sqlite.close());
  f.add("note_a", "reader@example.test", "question", "I am 100% sure about this question");
  f.add("note_b", "other@example.test", "question", "Another synthetic question");
  assert.equal((await readContactInbox(f.db, filters("q=%25"), now)).total, 1);
  assert.equal((await readContactInbox(f.db, filters("q=_"), now)).total, 0);
  assert.equal((await readContactInbox(f.db, filters("q=%27+OR+1%3D1--"), now)).total, 0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM contact_requests").get()?.total, 2);
});

test("status changes preserve message, email, received date and expiry and cannot revive expired notes", async t => {
  const f = fixture(); t.after(() => f.sqlite.close());
  f.add("active_note", "reader@example.test", "privacy");
  f.add("expired_note", "other@example.test", "delete", "Expired synthetic request", now - 100000, now);
  const before = f.sqlite.prepare("SELECT * FROM contact_requests WHERE id='active_note'").get()!;
  assert.equal((await updateContactStatus(f.db, "active_note", "in_progress", now))?.status, "in_progress");
  const after = f.sqlite.prepare("SELECT * FROM contact_requests WHERE id='active_note'").get()!;
  for (const key of ["email", "category", "message", "created_at", "expires_at"]) assert.equal(after[key], before[key]);
  assert.equal(after.updated_at, now);
  assert.equal(await updateContactStatus(f.db, "expired_note", "resolved", now), null);
  assert.equal(f.sqlite.prepare("SELECT status FROM contact_requests WHERE id='expired_note'").get()?.status, "new");
});

test("all enquiry API methods require founder access; guarded status edits and original deletion work", async t => {
  const f = fixture(); t.after(() => f.sqlite.close());
  f.add("synthetic_note", "reader@example.test", "privacy");
  let owner = false;
  const compiled = ts.transpileModule(readFileSync(new URL("../app/api/admin/requests/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: Record<string, (request: Request) => Promise<Response>> = {};
  const server = {
    isOwner: async () => owner, database: () => f.db,
    jsonBody: (request: Request) => request.json(),
    response: (body: unknown, status = 200) => Response.json(body, { status }),
    failed: (error: unknown) => { throw error; },
  };
  const fixedContacts = { ...contacts,
    readContactInbox: (db: D1Database, query: ReturnType<typeof filters>) => contacts.readContactInbox(db, query, now),
    updateContactStatus: (db: D1Database, id: string, status: string) => contacts.updateContactStatus(db, id, status, now),
  };
  new Function("require", "exports", compiled)((specifier: string) => {
    if (specifier === "@/lib/waitlist-server") return server;
    if (specifier === "@/lib/contact-requests") return fixedContacts;
    throw new Error(`Unexpected dependency ${specifier}`);
  }, exported);
  const call = (method: string, body?: unknown, query = "") => exported[method](new Request(`https://satinlore.com/api/admin/requests${query}`, { method, ...(body ? { headers: { "Content-Type": "application/json", "Origin": "https://satinlore.com" }, body: JSON.stringify(body) } : {}) }));
  for (const method of ["GET", "PATCH", "POST"]) assert.equal((await call(method, method === "GET" ? undefined : { id: "synthetic_note", status: "resolved" })).status, 403);
  assert.equal(f.prepares(), 0);
  owner = true;
  assert.equal((await call("GET", undefined, "?status=invalid")).status, 400);
  assert.equal((await call("GET")).status, 200);
  assert.equal((await call("PATCH", { id: "synthetic_note", status: "blocked" })).status, 400);
  assert.equal((await call("PATCH", { id: "synthetic_note", status: "resolved" })).status, 200);
  assert.equal((await call("PATCH", { id: "missing_note", status: "read" })).status, 404);
  assert.equal((await call("POST", { id: "synthetic_note" })).status, 200);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM contact_requests").get()?.total, 0);
});
