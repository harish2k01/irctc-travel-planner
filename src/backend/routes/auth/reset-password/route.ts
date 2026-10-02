import { z } from "zod";
import { passwordSchema } from "@/lib/api-schemas";
import { consumeAccountToken } from "@/lib/account-tokens";
import { createSession,getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError,assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rate-limit";
const schema=z.object({password:passwordSchema,token:z.string().min(20).optional(),type:z.enum(["invitation","reset"]).optional()}).strict().refine(v=>Boolean(v.token)===Boolean(v.type),"A complete password link is required.");
export async function POST(request:Request){try{assertSameOrigin(request);await enforceRateLimit(request,"auth:reset",10,3600000);const input=await parseJson(request,schema,4096);const hash=await hashPassword(input.password);const current=input.token?null:await getCurrentUser();
const userId=await prisma.$transaction(async tx=>{let id:string;if(input.token&&input.type){id=(await consumeAccountToken(input.token,input.type==="invitation"?"INVITATION":"PASSWORD_RESET",tx)).id;}else{if(!current)throw new ApiError(400,"A valid reset link is required.","INVALID_TOKEN");await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${current.id} FOR UPDATE`;const user=await tx.user.findUnique({where:{id:current.id}});if(!user?.isActive||!user.mustResetPassword)throw new ApiError(400,"A valid reset link is required.","INVALID_TOKEN");id=user.id;}await tx.user.update({where:{id},data:{passwordHash:hash,mustResetPassword:false,emailVerifiedAt:new Date()}});await tx.session.deleteMany({where:{userId:id}});await tx.accountToken.deleteMany({where:{userId:id,usedAt:null}});return id;});await createSession(userId,request);return jsonData({ok:true});}catch(e){return routeError(e,request);}}
