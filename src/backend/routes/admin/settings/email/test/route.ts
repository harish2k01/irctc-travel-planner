import { requireAdmin } from "@/lib/auth";
import { ApiError,assertSameOrigin,jsonData,routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendTestEmail } from "@/lib/mail";
export async function POST(request:Request){
 try{
  assertSameOrigin(request);const user=await requireAdmin();
  await enforceRateLimit(request,"smtp:test:"+user.id,3,300000);
  try{const result=await sendTestEmail(user.email);if(!result.sent)throw new ApiError(400,result.reason);}
  catch(error){if(error instanceof ApiError)throw error;const code=(error as {code?:string})?.code;const reason=code==="EAUTH"?"SMTP authentication failed. Check the username and password.":code==="ETIMEDOUT"?"SMTP timed out. Check the host, port, and network access.":code==="ESOCKET"?"Could not connect to SMTP. Check the host, port, and TLS settings.":"SMTP did not accept the test email. Check the saved connection, sender address, and recipient.";throw new ApiError(502,reason,"SMTP_TEST_FAILED");}
  return jsonData({message:"SMTP accepted the test email for your account. Check your inbox and spam folder."});
 }catch(error){return routeError(error,request);}
}
