import { decryptSecret } from "@/lib/crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { whatsappReady } from "@/lib/railplan-providers";
import { googleReady } from "@/lib/railplan-google";
export async function GET(request:Request){try{const user=await requireUser();const google=await prisma.railGoogle.findUnique({where:{userId:user.id},select:{enabled:true,syncedAt:true,lastError:true,calendarId:true}});const jobs=await prisma.railJob.findMany({where:{userId:user.id,state:{in:["SENT","FAILED"]}},orderBy:{updatedAt:"desc"},take:20,select:{id:true,kind:true,state:true,sentAt:true,lastError:true,payload:true,readAt:true}});return jsonData({whatsappReady:whatsappReady(),googleReady:googleReady(),google,jobs:jobs.map(({payload,...job})=>({...job,...(payload?JSON.parse(decryptSecret(payload)!):{})}))});}catch(e){return routeError(e,request);}}
export async function POST(request:Request){try{assertSameOrigin(request);const user=await requireUser();const input=await parseJson(request,z.union([z.object({googleEnabled:z.boolean()}),z.object({readId:z.string()})]));if("googleEnabled" in input)await prisma.railGoogle.updateMany({where:{userId:user.id},data:{enabled:input.googleEnabled}});else await prisma.railJob.updateMany({where:{id:input.readId,userId:user.id,state:"SENT"},data:{readAt:new Date()}});return jsonData({saved:true});}catch(e){return routeError(e,request);}}
