import {emailIsReady,getSendingStatus,type EmailSettings} from "@/lib/email-sender";
let cached:{key:string;expires:number;ready:boolean}|undefined;
export async function emailCanSend(settings:EmailSettings){
 if(!emailIsReady(settings))return false;
 const key=[settings.region,settings.fromEmail,settings.accessKeyId].join(":");
 if(cached?.key===key&&cached.expires>Date.now())return cached.ready;
 try{
  const status=await getSendingStatus(settings);
  const ready=status.configured&&status.sendingEnabled&&status.productionAccessEnabled&&status.identityVerified;
  cached={key,expires:Date.now()+60000,ready};return ready;
 }catch{return false;}
}
