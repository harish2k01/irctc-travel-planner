import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { getAppSettings } from "@/lib/settings";
import { getProviderConfiguration,providerSummary,providerUpdateSchema,resolveProviderConfiguration,updateProviderConfiguration } from "@/lib/provider-config";
import { enforceRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
export async function GET(request:Request){try{await requireAdmin();return jsonData(providerSummary(await getProviderConfiguration()));}catch(e){return routeError(e,request);}}
export async function PATCH(request:Request){try{
  assertSameOrigin(request);const actor=await requireAdmin();await enforceRateLimit(request,"admin:providers:"+actor.id,10,60000);const input=await parseJson(request,providerUpdateSchema,12288);await getAppSettings();
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "AppSettings" WHERE id='global' FOR UPDATE`;
    const settings=await tx.appSettings.findUniqueOrThrow({where:{id:"global"}});const changed=updateProviderConfiguration(resolveProviderConfiguration(settings.providerConfig),input);
    await tx.appSettings.update({where:{id:"global"},data:{providerConfig:changed.payload}});
    if(changed.googleChanged)await tx.railGoogle.updateMany({data:{enabled:false,lease:null,leaseUntil:null,lastError:"Google configuration changed. Reconnect your Google account in User Settings."}});
    return providerSummary(changed.next);
  });
  await writeAudit({actorId:actor.id,action:"providers.updated",targetType:"AppSettings",targetId:"global",request});return jsonData(result);
}catch(e){return routeError(e,request);}}
