import { isOwner,response } from "@/lib/waitlist-server";
import { emailSettings } from "@/lib/email-settings";
import {getSendingStatus} from "@/lib/email-sender";
export async function GET(){
  if(!await isOwner())return response({error:"Owner access required."},403);
  try{return response(await getSendingStatus(emailSettings()));}
  catch{return response({error:"Email account checks failed. Check sender access and settings."},503);}
}
