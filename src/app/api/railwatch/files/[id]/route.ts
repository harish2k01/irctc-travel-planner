import { getFeaturePolicy } from "@/lib/settings";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret,decryptSecret } from "@/lib/crypto";
import { ApiError,assertSameOrigin,jsonData,routeError,noStoreHeaders } from "@/lib/http";
import { decodeWorkspace } from "@/lib/railplan-store";
import { attachmentSchema } from "@/lib/travel-planner";
type Context={params:Promise<{id:string}>};
const MAX=10485760;
export async function GET(request:Request,context:Context){try{const user=await requireUser();const {id}=await context.params;const file=await prisma.railFile.findUnique({where:{userId_id:{userId:user.id,id}}});if(!file)throw new ApiError(404,"Ticket file not found.");const bytes=Buffer.from(decryptSecret(file.payload)!,"base64");return new Response(bytes,{headers:{...noStoreHeaders(),"Content-Type":file.type,"Content-Length":String(bytes.length),"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,"X-Content-Type-Options":"nosniff"}});}catch(e){return routeError(e,request);}}
export async function PUT(request:Request,context:Context){try{
  assertSameOrigin(request);const user=await requireUser();const {id}=await context.params;
  if(!(await getFeaturePolicy()).ticketUploadsEnabled)throw new ApiError(403,"Ticket uploads are disabled by the administrator.","FEATURE_DISABLED");
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(id))throw new ApiError(400,"Invalid attachment identifier.");
  const size=Number(request.headers.get("content-length"));if(size>MAX)throw new ApiError(413,"Tickets must be smaller than 10 MB.");
  const chunks:Uint8Array[]=[];let length=0;const reader=request.body?.getReader();if(!reader)throw new ApiError(400,"File content is required.");
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX){await reader.cancel();throw new ApiError(413,"Tickets must be smaller than 10 MB.");}chunks.push(value);}
  const bytes=Buffer.concat(chunks);const type=request.headers.get("content-type")??"";
  const meta=attachmentSchema.parse({id,name:decodeURIComponent(request.headers.get("x-file-name")??"ticket"),type,size:bytes.length,createdAt:new Date().toISOString()});
  const valid=type==="application/pdf"?bytes.subarray(0,1024).includes(Buffer.from("%PDF-")):type==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==="image/webp"?bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP":false;
  if(!valid)throw new ApiError(400,"The file contents do not match the PDF or image type.");
  await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;const old=await tx.railFile.findUnique({where:{userId_id:{userId:user.id,id}}});if(old){if(old.name!==meta.name||old.type!==meta.type||old.size!==meta.size||decryptSecret(old.payload)!==bytes.toString("base64"))throw new ApiError(409,"This attachment already exists. Upload it using a new identifier.");return;}
    const used=await tx.railFile.aggregate({where:{userId:user.id},_sum:{size:true}});if((used._sum.size??0)+bytes.length>250_000_000)throw new ApiError(413,"Your ticket storage limit is 250 MB. Remove unused files first.");
    await tx.railFile.create({data:{id,userId:user.id,name:meta.name,type:meta.type,size:meta.size,payload:encryptSecret(bytes.toString("base64"))}});
  });return jsonData(meta);
}catch(e){return routeError(e,request);}}
export async function DELETE(request:Request,context:Context){try{assertSameOrigin(request);const user=await requireUser();const {id}=await context.params;await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;const workspace=await tx.railWorkspace.findUnique({where:{userId:user.id}});if(workspace&&decodeWorkspace(workspace.payload).journeys.some(j=>j.attachments?.some(f=>f.id===id)))throw new ApiError(409,"Remove this attachment from its journey before deleting the original.");await tx.railFile.deleteMany({where:{userId:user.id,id}});});return jsonData({deleted:true});}catch(e){return routeError(e,request);}}
