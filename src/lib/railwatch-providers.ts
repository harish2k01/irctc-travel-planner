import { bookingTimeLabel,bookingDay,formatDay,type Journey } from "./travel-planner";
import { getProviderConfiguration,whatsappConfigured } from "./provider-config";
/** Checks the currently configured WhatsApp delivery provider. */
export async function whatsappReady(){return whatsappConfigured(await getProviderConfiguration());}
/** Sends an approved reminder template to the account recipient. */
export async function sendWhatsApp(number:string,journey:Journey){
  const config=await getProviderConfiguration();const whatsapp=config.whatsapp;
  if(!whatsappConfigured(config)||!whatsapp)throw new Error("WhatsApp is not configured.");
  if(journey.status==="cancellation_needed"&&!whatsapp.cancellationTemplateName)throw new Error("Add an approved cancellation template in Admin Settings to send WhatsApp cancellation reminders.");
  const to=number.replace(/^\+/,"");if(!/^[1-9]\d{7,14}$/.test(to))throw new Error("Invalid WhatsApp recipient.");
  const response=await fetch(`https://graph.facebook.com/${whatsapp.apiVersion}/${whatsapp.phoneNumberId}/messages`,{method:"POST",redirect:"error",headers:{Authorization:`Bearer ${whatsapp.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"template",template:{name:journey.status==="cancellation_needed"?whatsapp.cancellationTemplateName:whatsapp.templateName,language:{code:whatsapp.language},components:[{type:"body",parameters:[`${journey.from} to ${journey.to}`,formatDay(journey.date,{day:"numeric",month:"long",year:"numeric"}),...(journey.status==="cancellation_needed"?[]:[`${formatDay(bookingDay(journey),{day:"numeric",month:"long",year:"numeric"})}, ${bookingTimeLabel(journey)}`])].map(text=>({type:"text",text}))}]}}),signal:AbortSignal.timeout(15000)});
  const value=await response.json().catch(()=>({}));if(!response.ok||!value.messages?.[0]?.id)throw new Error("WhatsApp did not accept the reminder.");return String(value.messages[0].id);
}
