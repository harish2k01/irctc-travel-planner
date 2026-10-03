import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { ApiError,jsonData,routeError } from "@/lib/http";
import { ensureJourneyIndex,journeyQuerySchema,readJourneyPages } from "@/lib/journey-pages";
/** Returns owned indexed journey pages or a single journey requested by an inbox link. */
export async function GET(request:Request){try{const user=await requireUser(),url=new URL(request.url),id=url.searchParams.get("id");if(id){if(id.length>128)throw new ApiError(400,"Invalid journey.");await ensureJourneyIndex(user.id);const row=await prisma.railJourney.findUnique({where:{userId_id:{userId:user.id,id}},select:{payload:true}});if(!row)throw new ApiError(404,"Journey not found.","NOT_FOUND");return jsonData({journey:JSON.parse(decryptSecret(row.payload)!)});}return jsonData(await readJourneyPages(user.id,journeyQuerySchema.parse(Object.fromEntries(url.searchParams))));}catch(error){return routeError(error,request);}}
