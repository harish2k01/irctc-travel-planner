import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser,createSession } from "@/lib/auth";
import { passwordSchema } from "@/lib/api-schemas";
import { prisma } from "@/lib/db";
import { ApiError,assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hashPassword,verifyPassword } from "@/lib/passwords";
import { getFeaturePolicy } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
const details=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254).toLowerCase(),phoneNumber:z.string().trim().max(20).refine(v=>!v||/^\+[1-9]\d{7,14}$/.test(v),"Use an international number starting with +."),currentPassword:z.string().max(128).optional()}).strict();
const schema=z.union([details,z.object({currentPassword:z.string().min(1).max(128),newPassword:passwordSchema}).strict()]);
export async function GET(request:Request){try{const user=await requireUser();return jsonData({...user,name:user.name??user.email,policy:await getFeaturePolicy()});}catch(e){return routeError(e,request);}}
export async function PATCH(request:Request){try{assertSameOrigin(request);const user=await requireUser();await enforceRateLimit(request,"profile:"+user.id,10,60000);const input=await parseJson(request,schema,4096);const passwordHash="newPassword" in input?await hashPassword(input.newPassword):undefined;let rotate=false;
const saved=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;const record=await tx.user.findUniqueOrThrow({where:{id:user.id}});if(!record.isActive)throw new ApiError(401,"Sign in again.");rotate="newPassword" in input||("email" in input&&input.email!==record.email);if(rotate&&!await verifyPassword(input.currentPassword??"",record.passwordHash))throw new ApiError(400,"The current password is incorrect.","INVALID_PASSWORD");const saved=await tx.user.update({where:{id:user.id},data:"name" in input?{name:input.name,email:input.email,phoneNumber:input.phoneNumber||null,...(rotate?{emailVerifiedAt:null}:{})}:{passwordHash}});if(rotate){await tx.session.deleteMany({where:{userId:user.id}});await tx.accountToken.deleteMany({where:{userId:user.id,usedAt:null}});}return saved;});
if(rotate)await createSession(user.id,request);await writeAudit({actorId:user.id,action:"name" in input?"user.profile_updated":"user.password_changed",targetType:"User",targetId:user.id,request});return jsonData({id:saved.id,name:saved.name??saved.email,email:saved.email,phoneNumber:saved.phoneNumber??"",role:saved.role,policy:await getFeaturePolicy()});
}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")return routeError(new ApiError(409,"This email is already registered.","EMAIL_IN_USE"),request);return routeError(e,request);}}
