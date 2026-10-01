import { bookingDay,formatDay,type Journey } from "./travel-planner";
export function whatsappReady(){return Boolean(process.env.WHATSAPP_ACCESS_TOKEN&&/^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID??"")&&process.env.WHATSAPP_TEMPLATE_NAME&&/^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION??""));}
export async function sendWhatsApp(number:string,journey:Journey){
  if(!whatsappReady())throw new Error("WhatsApp is not configured.");
  const to=number.replace(/^\+/,"");if(!/^[1-9]\d{7,14}$/.test(to))throw new Error("Invalid WhatsApp recipient.");
  const response=await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",redirect:"error",headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"template",template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE??"en"},components:[{type:"body",parameters:[`${journey.from} to ${journey.to}`,formatDay(journey.date,{day:"numeric",month:"long",year:"numeric"}),`${formatDay(bookingDay(journey),{day:"numeric",month:"long",year:"numeric"})}, 8:00 AM IST`].map(text=>({type:"text",text}))}]}}),signal:AbortSignal.timeout(15000)});
  const value=await response.json().catch(()=>({}));if(!response.ok||!value.messages?.[0]?.id)throw new Error("WhatsApp did not accept the reminder.");return String(value.messages[0].id);
}
