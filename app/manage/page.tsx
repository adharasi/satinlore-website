"use client";
import {useEffect,useState} from "react";
import PageFrame from "@/lib/PageFrame";
export default function Manage(){
 const[token,setToken]=useState("");const[newsletter,setNewsletter]=useState(false);const[state,setState]=useState("loading");const[error,setError]=useState("");
 async function call(token:string,action:string,extra:Record<string,unknown>={}){const r=await fetch("/api/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,action,...extra})});const d=await r.json() as {error?:string;profile?:{newsletter:boolean}};if(!r.ok)throw new Error(d.error);return d;}
 useEffect(()=>{const t=window.location.hash.slice(1);setToken(t);if(!/^[a-f0-9]{64}$/.test(t)){setState("invalid");return;}call(t,"get").then(d=>{setNewsletter(!!d.profile?.newsletter);setState("ready");}).catch(e=>{setError(e.message);setState("invalid");});},[]);
 async function update(){setState("saving");setError("");try{await call(token,"newsletter",{newsletter});setState("saved");}catch(e){setError(e instanceof Error?e.message:"Please try again.");setState("ready");}}
 async function remove(){setState("saving");setError("");try{await call(token,"delete");history.replaceState(null,"","/manage");setToken("");setState("deleted");}catch(e){setError(e instanceof Error?e.message:"Please try again.");setState("ready");}}
 return <PageFrame title="Your news. Your choice.">
 {state==="loading"?<p role="status">Loading your choices…</p>:state==="deleted"?<p role="status">You’ve left the list. If you used more than one email, use the link for each one.</p>:state==="invalid"?<p>This link is missing or out of date. Use the link in your email, or <a href="/contact">get in touch</a>.</p>:<div style={{display:"grid",gap:24}}>
 <p>You can change your choice below. To stop all list emails, choose “Leave the list”.</p>
 <label style={{display:"flex",gap:12}}><input type="checkbox" checked={newsletter} onChange={e=>{setNewsletter(e.target.checked);setState("ready");}} /> Also send me tips and offers from Satinlore.</label>
 <button className="button" disabled={state==="saving"} onClick={update}>Save my choice</button>{state==="saved"&&<p role="status">Your choice is saved.</p>}
 <hr/><p>We’ll remove your waitlist details and stop news and offers. A survey or prize entry stays separate. For help with those choices, email team@satinlore.com.</p><button className="button" disabled={state==="saving"} onClick={remove}>Leave the list</button>
 </div>}{error&&<p className="form-error" role="alert">{error}</p>}
 </PageFrame>;
}
