import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import { createAccountToken,consumeAccountToken } from "@/lib/account-tokens";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError,assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDeliveryConfiguration } from "@/lib/settings";
import { sendVerificationEmail,smtpFailureReason } from "@/lib/mail";
const schema=z.union([z.object({action:z.literal("send")}).strict(),z.object({token:z.string().min(20).max(128)}).strict()]);
/** Sends a rate-limited verification link or consumes it explicitly, avoiding mail-scanner GET mutations. */
export async function POST(request:Request){try{
  assertSameOrigin(request);
  const input=await parseJson(request,schema,1024);
  if("token" in input){
    await enforceRateLimit(request,"auth:verify-email",10,3600000);
    const id=await prisma.$transaction(async tx=>{const user=await consumeAccountToken(input.token,"EMAIL_VERIFICATION",tx);await tx.user.update({where:{id:user.id},data:{emailVerifiedAt:new Date()}});return user.id;});
    await writeAudit({actorId:id,action:"user.email_verified",targetType:"User",targetId:id,request});
    return jsonData({verified:true});
  }
  const user=await requireUser();await enforceRateLimit(request,"email-verification:"+user.id,3,3600000);
  if(user.emailVerified)return jsonData({verified:true});
  if(!(await getDeliveryConfiguration()).smtpUrl)throw new ApiError(400,"Email delivery is not configured.","SMTP_NOT_CONFIGURED");
  const {token}=await createAccountToken(user.id,"EMAIL_VERIFICATION",1440,user.email);
  try{const result=await sendVerificationEmail(user.email,token);if(!result.sent)throw new ApiError(400,result.reason,"SMTP_NOT_CONFIGURED");}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(502,smtpFailureReason(error),"EMAIL_DELIVERY_FAILED");}
  return jsonData({sent:true});
}catch(error){return routeError(error,request);}}
