import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { loadWorkspace, saveWorkspace } from "@/lib/railplan-store";
import { plannerSchema } from "@/lib/travel-planner";
export async function GET(request:Request){try{return jsonData(await loadWorkspace((await requireUser()).id));}catch(e){return routeError(e,request);}}
export async function PUT(request:Request){try{assertSameOrigin(request);const user=await requireUser();const input=await parseJson(request,z.object({planner:plannerSchema,revision:z.number().int().min(1),base:plannerSchema.optional()}),8_000_000);return jsonData(await saveWorkspace(user.id,input.planner,input.revision,input.base));}catch(e){return routeError(e,request);}}
