type DnsAnswer = { type:number; data:string };
async function lookup(domain:string,type:"MX"|"A"):Promise<DnsAnswer[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name",domain);url.searchParams.set("type",type);
  const r = await fetch(url,{headers:{Accept:"application/dns-json"},signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw new Error("Email check unavailable");
  const data = await r.json() as {Status:number;Answer?:DnsAnswer[]};
  if(data.Status===3)return [];
  if(data.Status!==0)throw new Error("Email check unavailable");
  return data.Answer || [];
}
export async function domainCanReceiveMail(email:string) {
  const domain=email.split("@")[1];
  const mx=(await lookup(domain,"MX")).filter(a=>a.type===15);
  if(mx.some(a=>/^\s*0\s+\.\s*$/.test(a.data)))return false;
  if(mx.length)return true;
  return (await lookup(domain,"A")).some(a=>a.type===1);
}
