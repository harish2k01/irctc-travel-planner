import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { passwordSchema } from "@/lib/api-schemas";
import { hashPassword } from "@/lib/passwords";
import { ApiError,assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { createAccountToken } from "@/lib/account-tokens";
import { sendInvitationEmail } from "@/lib/mail";
import { enforceRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
const schema=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254).toLowerCase(),role:z.enum(["ADMIN","USER"]).default("USER"),mode:z.enum(["create","invite"]),password:passwordSchema.optional()}).strict();
/** Lists manageable user accounts for administrators. */
export async function GET(request:Request){try{await requireAdmin();const users=await prisma.user.findMany({orderBy:{createdAt:"asc"},select:{id:true,name:true,email:true,phoneNumber:true,role:true,isActive:true,mustResetPassword:true,passwordHash:true,createdAt:true}});return jsonData({users:users.map(({passwordHash,...user})=>({...user,pendingInvitation:!passwordHash}))});}catch(e){return routeError(e,request);}}
/** Creates an account or invitation under the instance signup policy. */
export async function POST(request:Request){try{assertSameOrigin(request);const actor=await requireAdmin();await enforceRateLimit(request,"admin:users:"+actor.id,20,60000);const input=await parseJson(request,schema,4096);if(input.mode==="create"&&!input.password)throw new ApiError(400,"Enter a temporary password.");const passwordHash=input.mode==="create"?await hashPassword(input.password!):null;const user=await prisma.user.create({data:{name:input.name,email:input.email,role:input.role,passwordHash,mustResetPassword:true}});let invitationUrl:string|undefined,emailSent=false;if(input.mode==="invite"){const {token}=await createAccountToken(user.id,"INVITATION",1440);invitationUrl=new URL("/set-password",process.env.APP_URL??request.url).href+"?type=invitation&token="+encodeURIComponent(token);try{emailSent=(await sendInvitationEmail(user.email,token)).sent;}catch{/* The admin can share the one-time link if delivery fails. */}}
await writeAudit({actorId:actor.id,action:input.mode==="invite"?"user.invited":"user.created",targetType:"User",targetId:user.id,request});return jsonData({id:user.id,invitationUrl,emailSent});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")return routeError(new ApiError(409,"This email is already registered.","EMAIL_IN_USE"),request);return routeError(e,request);}}
