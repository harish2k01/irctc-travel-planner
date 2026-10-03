import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";
import { loadWorkspace,loadWorkspaceMetadata, saveWorkspace } from "@/lib/railwatch-store";
import { plannerSchema } from "@/lib/travel-planner";
/** Loads the current account workspace with routine, lifecycle, and ticket-retention reconciliation. */
export async function GET(request:Request){try{const user=await requireUser();return jsonData(new URL(request.url).searchParams.get("partial")==="1"?await loadWorkspaceMetadata(user.id):await loadWorkspace(user.id));}catch(e){return routeError(e,request);}}
/** Validates and saves compatible account edits using the supplied concurrency revision. */
export async function PUT(request:Request){try{assertSameOrigin(request);const user=await requireUser();const input=await parseJson(request,z.object({planner:plannerSchema,revision:z.number().int().min(1),base:plannerSchema.optional(),partial:z.boolean().default(false)}),8_000_000);return jsonData(await saveWorkspace(user.id,input.planner,input.revision,input.base,input.partial));}catch(e){return routeError(e,request);}}
