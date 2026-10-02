import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError,assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { createAccountToken } from "@/lib/account-tokens";
import { sendInvitationEmail } from "@/lib/mail";
import { enforceRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
type Context={params:Promise<{id:string}>};
const schema=z.object({role:z.enum(["ADMIN","USER"]).optional(),isActive:z.boolean().optional()}).strict().refine(v=>v.role!==undefined||v.isActive!==undefined);
/** Updates another account role or access and prevents administrator lockout. */
export async function PATCH(request:Request,context:Context){try{assertSameOrigin(request);const actor=await requireAdmin();const {id}=await context.params;const input=await parseJson(request,schema,1024);if(id===actor.id)throw new ApiError(400,"Use another administrator to change your own role or access.");await prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(846215)`;const user=await tx.user.findUnique({where:{id}});if(!user)throw new ApiError(404,"User not found.");if(user.role==="ADMIN"&&user.isActive&&(input.role==="USER"||input.isActive===false)&&await tx.user.count({where:{role:"ADMIN",isActive:true}})<=1)throw new ApiError(400,"At least one active administrator is required.");await tx.user.update({where:{id},data:input});await tx.session.deleteMany({where:{userId:id}});});await writeAudit({actorId:actor.id,action:"user.access_updated",targetType:"User",targetId:id,request});return jsonData({saved:true});}catch(e){return routeError(e,request);}}
/** Regenerates a one-time invitation for the selected account. */
export async function POST(request:Request,context:Context){try{assertSameOrigin(request);const actor=await requireAdmin();await enforceRateLimit(request,"admin:invite:"+actor.id,10,60000);const {id}=await context.params;const user=await prisma.user.findUnique({where:{id}});if(!user||!user.isActive)throw new ApiError(404,"Active user not found.");if(user.passwordHash)throw new ApiError(400,"This account is already set up. The user can request a password reset.");const {token}=await createAccountToken(id,"INVITATION",1440);const invitationUrl=new URL("/set-password",process.env.APP_URL??request.url).href+"?type=invitation&token="+encodeURIComponent(token);let emailSent=false;try{emailSent=(await sendInvitationEmail(user.email,token)).sent;}catch{}await writeAudit({actorId:actor.id,action:"user.invited",targetType:"User",targetId:id,request});return jsonData({invitationUrl,emailSent});}catch(e){return routeError(e,request);}}
