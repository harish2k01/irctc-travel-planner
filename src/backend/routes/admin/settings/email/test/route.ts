import { requireAdmin } from "@/lib/auth";
import { ApiError,assertSameOrigin,jsonData,routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { smtpFailureReason } from "@/lib/mail";
import { sendTestEmail } from "@/lib/mail";
/** Sends a rate-limited SMTP test to the authenticated administrator with actionable failure feedback. */
export async function POST(request:Request){
 try{
  assertSameOrigin(request);const user=await requireAdmin();
  await enforceRateLimit(request,"smtp:test:"+user.id,3,300000);
  try{const result=await sendTestEmail(user.email);if(!result.sent)throw new ApiError(400,result.reason);}
  catch(error){if(error instanceof ApiError)throw error;const reason=smtpFailureReason(error);throw new ApiError(502,reason,"SMTP_TEST_FAILED");}
  return jsonData({message:"SMTP accepted the test email for your account. Check your inbox and spam folder."});
 }catch(error){return routeError(error,request);}
}
