"use client";
import { useState, type FormEvent } from "react";
import PageFrame from "@/lib/PageFrame";
export default function Contact() {
  const [state,setState] = useState("idle");
  const [error,setError] = useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setState("saving"); setError("");
    try {
      const res = await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),category:f.get("category"),message:f.get("message"),company:f.get("company"),consent:f.get("consent")==="on"})});
      const data = await res.json() as {error?: string}; if(!res.ok) throw new Error(data.error || "Please try again."); setState("done");
    } catch(e) {setError(e instanceof Error?e.message:"Please try again.");setState("idle");}
  }
  return <PageFrame title="A note to the founder.">
    <p>Have a question, a new idea, or a note about your data? Send a short note to the founder. Please leave out stories and private details.</p>
    {state==="done"?<div role="status" className="notice">Your note is saved. The founder will read it soon.</div>:<form onSubmit={submit} style={{display:"grid",gap:18,marginTop:28}}>
      <label className="field">Email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label className="field">About<select name="category" defaultValue="question"><option value="question">A question</option><option value="partner">Work with us</option><option value="privacy">Help with my data</option><option value="delete">Leave the list</option></select></label>
      <label className="field">Your message<textarea name="message" rows={5} required minLength={5} maxLength={1000} /></label>
      <div style={{position:"absolute",left:-10000}} aria-hidden="true"><label>Company<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
      <label style={{display:"flex",gap:12,alignItems:"flex-start"}}><input name="consent" type="checkbox" required style={{marginTop:7}} /><span>I agree that Satinlore may keep this note and my email so it can reply. <a href="/privacy">Privacy note</a>.</span></label>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <button className="button" type="submit" disabled={state==="saving"}>{state==="saving"?"Saving…":"Send note ↗"}</button>
    </form>}
  </PageFrame>;
}
