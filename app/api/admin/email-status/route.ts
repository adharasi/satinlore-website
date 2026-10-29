import { isOwner,response } from "@/lib/waitlist-server";
import { emailSettings } from "@/lib/email-settings";
import {getSendingStatus} from "@/lib/email-sender";
import { emailCheckFailure } from "@/lib/email-check-error";
export async function GET(){
  if(!await isOwner())return response({error:"Owner access required."},403);
  try{return response(await getSendingStatus(emailSettings()));}
  catch(error){return response(emailCheckFailure(error),503);}
}
