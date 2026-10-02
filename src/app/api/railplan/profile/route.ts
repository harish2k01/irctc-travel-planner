import { z } from "zod";
import { requireUser, createSession } from "@/lib/auth";
import { passwordSchema } from "@/lib/api-schemas";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/passwords";
const schema=z.union([z.object({name:z.string().trim().min(2).max(120)}).strict(),z.object({currentPassword:z.string().min(1).max(128),newPassword:passwordSchema}).strict()]);
export async function GET(request:Request){try{const user=await requireUser();return jsonData({name:user.name??user.email,email:user.email});}catch(e){return routeError(e,request);}}
export async function PATCH(request:Request){try{assertSameOrigin(request);const user=await requireUser();await enforceRateLimit(request,"profile:"+user.id,10,60000);const input=await parseJson(request,schema,4096);
if("name" in input){await prisma.user.update({where:{id:user.id},data:{name:input.name}});return jsonData({name:input.name});}
const passwordHash=await hashPassword(input.newPassword);
await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;const record=await tx.user.findUniqueOrThrow({where:{id:user.id}});if(!record.isActive||!await verifyPassword(input.currentPassword,record.passwordHash))throw new ApiError(400,"The current password is incorrect.","INVALID_PASSWORD");await tx.user.update({where:{id:user.id},data:{passwordHash}});await tx.session.deleteMany({where:{userId:user.id}});await tx.accountToken.deleteMany({where:{userId:user.id,type:"PASSWORD_RESET",usedAt:null}});});
await createSession(user.id,request);return jsonData({ok:true});
}catch(e){return routeError(e,request);}}
