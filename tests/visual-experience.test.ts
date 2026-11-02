import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
const { EXPERIENCE_LAYOUT, EXPERIENCE_CONSENT_VERSION, EXPERIENCE_VISUAL_BODY_BYTES, EXPERIENCE_VISUAL_MAX_BYTES, EXPERIENCE_VISUAL_MAX_EVENTS, EXPERIENCE_VISUAL_GLOBAL_BYTES, experienceConsentAllowed, writeExperience, readExperienceDetail, readExperienceOverview, deleteExperienceSession, readExperienceJson } = await import(new URL("../lib/website-experience.ts",import.meta.url).href);
const { validateVisualEvents } = await import(new URL("../lib/visual-replay-codec.mjs",import.meta.url).href);
const { purgeExpiredRecords } = await import(new URL("../lib/data-retention.ts",import.meta.url).href);

const origin = "https://satinlore.com", now = Date.UTC(2026, 10, 2, 20);
const start = {action:"start",v:2,format:"rrweb-v1",layout:EXPERIENCE_LAYOUT,viewport:{w:1360,h:900,dh:9000},consent:true};
function request(body: unknown = start, extra: Record<string,string> = {}) {return new Request(origin+"/api/experience",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Cookie:"satinlore_consent=v2.1.1","User-Agent":"Mozilla/5.0 Desktop","CF-Connecting-IP":"192.0.2.25",...extra},body:JSON.stringify(body)});}
function fixture(allMigrations=false){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON;");
  if(!allMigrations)sqlite.exec("CREATE TABLE rate_limits(key TEXT PRIMARY KEY,count INTEGER,expires_at INTEGER);");
  const files=allMigrations?readdirSync(new URL("../drizzle/",import.meta.url)).filter(name=>name.endsWith(".sql")).sort():["0009_website_experience.sql","0010_visual_website_replay.sql"];
  for(const file of files)sqlite.exec(readFileSync(new URL("../drizzle/"+file,import.meta.url),"utf8"));
  const db={prepare(sql:string){let values:(string|number)[]=[];return{bind(...items:(string|number)[]){values=items;return this;},run(){return sqlite.prepare(sql).run(...values);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return{results:sqlite.prepare(sql).all(...values)};}};},async batch(statements:{run:()=>unknown}[]){sqlite.exec("BEGIN");try{const result=statements.map(item=>item.run());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}} as unknown as D1Database;
  return{sqlite,db};
}
async function admitted(db:D1Database,body:Record<string,unknown>=start){const value=await writeExperience(db,request(body),body,"neutral-salt",now) as {sid:string;token:string};return {sid:value.sid,token:value.token};}
const node={type:0,id:1,childNodes:[{type:2,id:2,tagName:"html",attributes:{},childNodes:[{type:2,id:3,tagName:"body",attributes:{},childNodes:[{type:2,id:4,tagName:"p",attributes:{},childNodes:[{type:3,id:5,textContent:"A neutral public fixture."}]}]}]}]};
const snapshot=[{type:4,timestamp:0,data:{href:"/",width:1360,height:900}},{type:2,timestamp:0,data:{node,initialOffset:{left:0,top:0}}}];
const click=[{type:3,timestamp:1000,data:{source:2,type:2,id:4,x:120,y:200}}];
const visual=(s:{sid:string;token:string},seq=0,events:unknown[]=snapshot)=>({action:"visual",...s,seq,events});

test("fresh category consent is required for visual admission; legacy consent cannot expand scope",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());
  for(const cookie of ["","satinlore_replay=on","satinlore_consent=v1.1.1","satinlore_consent=v2.1.0","satinlore_consent=v2.0.0"]){assert.equal(experienceConsentAllowed(request(start,{Cookie:cookie})),false);await assert.rejects(writeExperience(db,request(start,{Cookie:cookie}),start,"neutral-salt",now));}
  const session=await writeExperience(db,request(start,{Cookie:"satinlore_consent=v2.0.1; satinlore_measurement=off"}),start,"neutral-salt",now) as {sid:string};
  const row=sqlite.prepare("SELECT * FROM website_experience_sessions WHERE id=?").get(session.sid)!;
  assert.equal(row.visual_format,"rrweb-v1");assert.equal(row.consent_version,EXPERIENCE_CONSENT_VERSION);
  assert.equal(row.visual_event_count,0);assert.doesNotMatch(JSON.stringify(row),/Mozilla|192\.0\.2|neutral-salt/);
});

test("real SQLite stores visual batches beside numeric heatmaps with independent idempotent sequences",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());const s=await admitted(db);
  const first=visual(s);await writeExperience(db,request(first),first,"neutral-salt",now+500);
  const retry=await writeExperience(db,request(first),first,"neutral-salt",now+600);assert.deepEqual(retry,{ok:true,accepted:true,seq:0,duplicate:true});
  const numeric={action:"append",...s,seq:0,events:[{t:1200,k:"click",x:120,y:200}]};await writeExperience(db,request(numeric),numeric,"neutral-salt",now+1500);
  const second=visual(s,1,click);await writeExperience(db,request(second),second,"neutral-salt",now+1600);
  const detail=await readExperienceDetail(db,s.sid,now+2000);assert.equal(detail.visual?.format,"rrweb-v1");assert.equal(detail.visual?.events.length,3);assert.equal(detail.visual?.incomplete,false);assert.equal(detail.visual?.durationMs,1000);assert.equal(detail.events.length,1);assert.equal(detail.session.visual,true);assert.equal(detail.session.visualEventCount,3);
  const storedBytes=sqlite.prepare("SELECT SUM(byte_count) n FROM website_visual_batches WHERE session_id=?").get(s.sid)?.n; assert.equal(detail.visual?.bytes,storedBytes);
  assert.equal((await readExperienceOverview(db,{days:7,device:"all",page:1},now+2000)).summary.clicks,1);
  assert.doesNotMatch(JSON.stringify(detail),/token|hash|salt|192\.0\.2/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches").get()?.n,2);
});

test("visual ownership, conflicting retries, time bounds and session caps fail closed",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());const s=await admitted(db),first=visual(s);
  await assert.rejects(writeExperience(db,request(),{...first,token:"0".repeat(64)},"neutral-salt",now+1),/available/);
  await assert.rejects(writeExperience(db,request(),visual(s,1),"neutral-salt",now+1),/sequence/);
  await writeExperience(db,request(),first,"neutral-salt",now+1);
  await assert.rejects(writeExperience(db,request(),visual(s,0,[{...snapshot[0],data:{href:"/",width:1200,height:900}},snapshot[1]]),"neutral-salt",now+2),/changed/);
  await assert.rejects(writeExperience(db,request(),visual(s,1,[{...click[0],timestamp:600001}]),"neutral-salt",now+2));
  await assert.rejects(writeExperience(db,request(),visual(s,1,click),"neutral-salt",now+660001),/ended/);
  sqlite.prepare("UPDATE website_experience_sessions SET visual_bytes=? WHERE id=?").run(EXPERIENCE_VISUAL_MAX_BYTES,s.sid);
  await assert.rejects(writeExperience(db,request(),visual(s,1,click),"neutral-salt",now+2),/limit/);
  sqlite.prepare("UPDATE website_experience_sessions SET visual_bytes=0,visual_event_count=? WHERE id=?").run(EXPERIENCE_VISUAL_MAX_EVENTS,s.sid);
  await assert.rejects(writeExperience(db,request(),visual(s,1,click),"neutral-salt",now+2),/limit/);
  const legacy=await admitted(db,{action:"start",v:1,layout:EXPERIENCE_LAYOUT,viewport:start.viewport,consent:true});
  await assert.rejects(writeExperience(db,request(),visual(legacy),"neutral-salt",now+2),/available/);
});

test("visual deletion, withdrawal and expiry keep unrelated and legacy recordings intact",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());const one=await admitted(db),two=await admitted(db);
  await writeExperience(db,request(),visual(one),"neutral-salt",now+1);await writeExperience(db,request(),visual(two),"neutral-salt",now+1);
  const withdraw={action:"withdraw",...one};await writeExperience(db,request(withdraw,{Cookie:"satinlore_consent=v2.0.0",DNT:"1"}),withdraw,undefined,now+2);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches WHERE session_id=?").get(one.sid)?.n,0);
  assert.equal((await readExperienceDetail(db,two.sid,now+3)).visual?.events.length,2);
  assert.equal((await deleteExperienceSession(db,two.sid)).deleted,true);assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches").get()?.n,0);
  const expired=await admitted(db);await writeExperience(db,request(),visual(expired),"neutral-salt",now+1);sqlite.prepare("UPDATE website_experience_sessions SET expires_at=? WHERE id=?").run(now,expired.sid);await assert.rejects(readExperienceDetail(db,expired.sid,now+2),/expired/);
});

test("concurrent visual retries do not double storage counters; corrupted details remain incomplete",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());const s=await admitted(db),first=visual(s);
  await Promise.all([writeExperience(db,request(),first,"neutral-salt",now+1),writeExperience(db,request(),first,"neutral-salt",now+1)]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches").get()?.n,1);
  assert.equal((await readExperienceDetail(db,s.sid,now+2)).session.visualEventCount,2);
  sqlite.prepare("UPDATE website_visual_batches SET events='[]' WHERE session_id=?").run(s.sid);
  assert.equal((await readExperienceDetail(db,s.sid,now+3)).visual?.incomplete,true);
});

test("server privacy maps reject later masked-node mutations and count UTF-8 storage bytes",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());const s=await admitted(db);
  const tree=structuredClone(node);
  const privateForm={type:2,id:10,tagName:"form",attributes:{class:"signup-card"},childNodes:[{type:2,id:11,tagName:"input",attributes:{value:"PRIVATE_CANARY_20261102"},childNodes:[]}]};
  (tree.childNodes[0].childNodes[0].childNodes as unknown[]).push(privateForm);
  const initial=[snapshot[0],{...snapshot[1],data:{node:tree,initialOffset:{left:0,top:0}}}];
  await writeExperience(db,request(),visual(s,0,initial),"neutral-salt",now+1);
  assert.doesNotMatch(String(sqlite.prepare("SELECT events FROM website_visual_batches WHERE session_id=?").get(s.sid)?.events),/PRIVATE_CANARY|value|<script/);
  const mutation=(id:number,value:string)=>[{type:3,timestamp:1000,data:{source:0,texts:[{id,value}],attributes:[],removes:[],adds:[]}}];
  for(const id of [10,11,999])await assert.rejects(writeExperience(db,request(),visual(s,1,mutation(id,"PRIVATE_CANARY_20261102")),"neutral-salt",now+2));
  const valid=visual(s,1,mutation(5,"A public café — 静かな page."));await writeExperience(db,request(),valid,"neutral-salt",now+2);
  const row=sqlite.prepare("SELECT events,byte_count FROM website_visual_batches WHERE session_id=? AND seq=1").get(s.sid)!;
  assert.equal(row.byte_count,new TextEncoder().encode(String(row.events)).byteLength);assert.ok(Number(row.byte_count)>String(row.events).length);
  assert.equal((await readExperienceDetail(db,s.sid,now+3)).visual?.incomplete,false);
});

test("visual body allowance is explicit and bounded; the default small API body stays unchanged",async()=>{
  const body={text:"a".repeat(30000)};
  await assert.rejects(readExperienceJson(request(body)));
  assert.deepEqual(await readExperienceJson(request(body),EXPERIENCE_VISUAL_BODY_BYTES),body);
  await assert.rejects(readExperienceJson(request({text:"a".repeat(EXPERIENCE_VISUAL_BODY_BYTES)}),EXPERIENCE_VISUAL_BODY_BYTES));
});

test("scheduled retention removes expired visual children without changing current CRM or email jobs",async t=>{
  const {sqlite,db}=fixture(true);t.after(()=>sqlite.close());
  const expired=await admitted(db),retained=await admitted(db);
  await writeExperience(db,request(),visual(expired),"neutral-salt",now+1);await writeExperience(db,request(),visual(retained),"neutral-salt",now+1);
  sqlite.prepare("UPDATE website_experience_sessions SET expires_at=? WHERE id=?").run(now,expired.sid);
  sqlite.prepare("INSERT INTO waitlist(id,email,token_hash,created_at,expires_at,consent_version,email_verified) VALUES(?,?,?,?,?,?,1)").run("neutral-waitlist","neutral@example.test","1".repeat(64),now,now+86400000,"synthetic");
  sqlite.prepare("INSERT INTO crm_contacts(email,stage,notes,updated_at) VALUES(?,?,?,?)").run("neutral@example.test","new","Synthetic retained note",now);
  sqlite.prepare("INSERT INTO survey_email_jobs(email,waitlist_id,due_at,next_attempt_at,created_at) VALUES(?,?,?,?,?)").run("neutral@example.test","neutral-waitlist",now+300000,now+300000,now);
  const before=JSON.stringify({contact:sqlite.prepare("SELECT * FROM crm_contacts").get(),job:sqlite.prepare("SELECT * FROM survey_email_jobs").get()});
  await purgeExpiredRecords(db,now+2);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches WHERE session_id=?").get(expired.sid)?.n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_sessions WHERE id=?").get(expired.sid)?.n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches WHERE session_id=?").get(retained.sid)?.n,1);
  assert.equal(JSON.stringify({contact:sqlite.prepare("SELECT * FROM crm_contacts").get(),job:sqlite.prepare("SELECT * FROM survey_email_jobs").get()}),before);
});

test("the global visual budget is atomic across sessions and leaves numeric capture working",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());
  const reserve=await admitted(db),one=await admitted(db),two=await admitted(db);
  const bytes=new TextEncoder().encode(JSON.stringify(validateVisualEvents(snapshot))).byteLength;
  // Seed the quota counter, not a 128 MiB test blob. Exactly one snapshot fits.
  sqlite.prepare("UPDATE website_experience_sessions SET visual_bytes=? WHERE id=?").run(EXPERIENCE_VISUAL_GLOBAL_BYTES-bytes,reserve.sid);
  const outcomes=await Promise.allSettled([writeExperience(db,request(),visual(one),"neutral-salt",now+1),writeExperience(db,request(),visual(two),"neutral-salt",now+1)]);
  assert.equal(outcomes.filter(result=>result.status==="fulfilled").length,1);
  const denied=outcomes.find(result=>result.status==="rejected") as PromiseRejectedResult;assert.equal(denied.reason.status,429);
  assert.equal(sqlite.prepare("SELECT SUM(visual_bytes) bytes FROM website_experience_sessions").get()?.bytes,EXPERIENCE_VISUAL_GLOBAL_BYTES);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches").get()?.n,1);
  const numeric={action:"append",...one,seq:0,events:[{t:1000,k:"click",x:50,y:50}]};
  assert.equal((await writeExperience(db,request(),numeric,"neutral-salt",now+2)).ok,true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_batches").get()?.n,1);
});

test("expired visual bytes remain charged until actual cleanup frees the shared budget",async t=>{
  const {sqlite,db}=fixture(true);t.after(()=>sqlite.close());const expired=await admitted(db),current=await admitted(db);
  sqlite.prepare("UPDATE website_experience_sessions SET visual_bytes=?,expires_at=? WHERE id=?").run(EXPERIENCE_VISUAL_GLOBAL_BYTES,now,expired.sid);
  await assert.rejects(writeExperience(db,request(),visual(current),"neutral-salt",now+1),(error:unknown)=>(error as {status:number}).status===429);
  await purgeExpiredRecords(db,now+2);
  assert.equal((await writeExperience(db,request(),visual(current),"neutral-salt",now+3)).ok,true);
  assert.ok(Number(sqlite.prepare("SELECT SUM(visual_bytes) bytes FROM website_experience_sessions").get()?.bytes)<EXPERIENCE_VISUAL_GLOBAL_BYTES);
});

test("withdrawal during a pending visual commit cannot recreate the deleted session",async t=>{
  const {sqlite,db}=fixture();t.after(()=>sqlite.close());const owned=await admitted(db),other=await admitted(db);
  await writeExperience(db,request(),visual(other),"neutral-salt",now+1);
  let release:()=>void=()=>{};let entered:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>{release=resolve;});const reached=new Promise<void>(resolve=>{entered=resolve;});
  const delayed={...db,async batch(statements:D1PreparedStatement[]){entered();await waiting;return db.batch(statements);}} as D1Database;
  const pending=writeExperience(delayed,request(),visual(owned),"neutral-salt",now+2);await reached;
  const withdrawal={action:"withdraw",...owned};await writeExperience(db,request(withdrawal,{Cookie:"satinlore_consent=v2.0.0",DNT:"1"}),withdrawal,undefined,now+3);
  release();await assert.rejects(pending);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_sessions WHERE id=?").get(owned.sid)?.n,0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_visual_batches WHERE session_id=?").get(owned.sid)?.n,0);
  assert.equal((await readExperienceDetail(db,other.sid,now+4)).visual?.events.length,2);
});
