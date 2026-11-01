import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
const { purgeExpiredRecords } = await import(new URL("../lib/data-retention.ts",import.meta.url).href);

test("each admin page denies access before reading private records or runtime settings", async () => {
  for (const path of ["page.tsx","readers/page.tsx","messages/page.tsx","email/page.tsx"]) {
    const source = ts.transpileModule(readFileSync(new URL(`../app/admin/${path}`,import.meta.url),"utf8"),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
    }).outputText;
    let checks=0;
    const noData=() => { throw new Error(`Private records accessed before authentication: ${path}`); };
    const exports: {default?: (props?:unknown)=>Promise<{props:{title:string}}> } = {};
    new Function("require","exports",source)((name:string) => {
      if(name==="react/jsx-runtime")return {jsx:(type:unknown,props:unknown)=>({type,props}),jsxs:(type:unknown,props:unknown)=>({type,props})};
      if(name==="@/lib/waitlist-server")return {isOwner:async()=>{checks++;return false;},database:noData,cleanExpired:noData,runtime:noData};
      if(name==="@/lib/site-analytics")return {readAnalyticsOverview:noData};
      if(name==="@/lib/email-suppression")return {withMarketingSuppression:noData};
      if(name==="@/lib/crm-query")return {CRM_CONTACTS_SQL:"synthetic-private-query"};
      if(["@/lib/PageFrame","@/lib/AdminShell","@/lib/AdminMetricsPanel","@/lib/CrmPanel","@/lib/ContactRequestsPanel","@/lib/EmailSetupPanel"].includes(name))return {default:()=>null};
      throw new Error(`Unreviewed page dependency ${name}`);
    },exports);
    const result=await exports.default!({searchParams:Promise.resolve({days:"90"})});
    assert.equal(checks,1,path);
    assert.equal(result.props.title,"Founder access only.",path);
  }
});

function migratedDatabase() {
  const db=new DatabaseSync(":memory:");
  const directory=new URL("../drizzle/",import.meta.url);
  const files=readdirSync(directory).filter(name=>name.endsWith(".sql")).sort();
  for(const name of files)if(name < "0007_")db.exec(readFileSync(new URL(name,directory),"utf8"));
  return {db,applyNew:()=>{for(const name of files)if(name >= "0007_")db.exec(readFileSync(new URL(name,directory),"utf8"));}};
}

test("the additive release migration preserves old contact notes and creates query indexes", () => {
  const {db,applyNew}=migratedDatabase();
  db.prepare("INSERT INTO contact_requests(id,email,category,message,created_at,expires_at) VALUES(?,?,?,?,?,?)").run("old_note","reader@example.test","privacy","Synthetic note",1000,9000);
  applyNew();
  const note=db.prepare("SELECT email,message,status,updated_at,expires_at FROM contact_requests WHERE id='old_note'").get();
  assert.deepEqual({...note},{email:"reader@example.test",message:"Synthetic note",status:"new",updated_at:null,expires_at:9000});
  const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='contact_requests'").all().map(row=>row.name);
  for(const name of ["contact_requests_email_created_idx","contact_requests_status_created_idx","contact_requests_expires_created_idx"])assert.ok(indexes.includes(name));
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='queue_survey_after_verification'").get());
  db.close();
});

test("retention removes expired messages and old aggregate totals while keeping current records", async () => {
  const {db,applyNew}=migratedDatabase();applyNew();
  const now=Date.UTC(2026,10,1,12);
  const insert=db.prepare("INSERT INTO contact_requests(id,email,category,message,created_at,expires_at,status) VALUES(?,?,?,?,?,?,?)");
  insert.run("current","reader@example.test","question","Current synthetic note",now-1000,now+1000,"resolved");
  insert.run("expired","old@example.test","privacy","Expired synthetic note",now-1000,now,"new");
  const metric=db.prepare("INSERT INTO website_metrics(day,event,page,source,referrer,device,count,last_seen) VALUES(?,'page_view','/','direct','direct','desktop',1,?)");
  metric.run(new Date(now-90*86400000).toISOString().slice(0,10),now);
  metric.run(new Date(now-89*86400000).toISOString().slice(0,10),now);
  const driver={prepare(sql:string){let values:unknown[]=[];return {bind(...bound:unknown[]){values=bound;return this;},run(){return db.prepare(sql).run(...values as (string|number)[]);}};},batch:async(statements:{run:()=>unknown}[])=>statements.map(statement=>statement.run())} as unknown as D1Database;
  await purgeExpiredRecords(driver,now);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM contact_requests").get()!.n,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM website_metrics").get()!.n,1);
  assert.equal(db.prepare("SELECT id FROM contact_requests").get()!.id,"current");
  db.close();
});
