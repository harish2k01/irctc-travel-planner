import { requireUser } from "@/lib/auth";
import { getFeaturePolicy } from "@/lib/settings";
import { completeTelegramLogin } from "@/lib/telegram-login";
export async function GET(request:Request){
 const result=new URL("/",process.env.APP_URL??request.url);
 try{const user=await requireUser(),policy=await getFeaturePolicy(),url=new URL(request.url);if(!policy.remindersEnabled||!policy.telegramEnabled||url.searchParams.has("error"))throw new Error("Authorization unavailable");await completeTelegramLogin(user.id,url.searchParams.get("state")??"",url.searchParams.get("code")??"");result.searchParams.set("telegram","connected");}
 catch{result.searchParams.set("telegram","failed");}
 return new Response(null,{status:303,headers:{Location:result.href,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
}
