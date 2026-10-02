import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { ApiError,assertSameOrigin,jsonData,routeError } from "@/lib/http";
import { getProviderConfiguration,providerSummary,resolveProviderConfiguration } from "@/lib/provider-config";
import { telegramRequest } from "@/lib/telegram";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function POST(request:Request){try{
 assertSameOrigin(request);const user=await requireAdmin();await enforceRateLimit(request,"telegram:setup:"+user.id,5,60000);
 const config=await getProviderConfiguration(),bot=config.telegram;if(!bot)throw new ApiError(400,"Save your bot configuration first.");
 const identity=await telegramRequest<{username:string}>(bot.botToken,"getMe");if(identity.username?.toLowerCase()!==bot.botUsername.toLowerCase())throw new ApiError(400,"The bot username does not match this token.");
 const summary=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "AppSettings" WHERE id='global' FOR UPDATE`;const settings=await tx.appSettings.findUniqueOrThrow({where:{id:"global"}}),current=resolveProviderConfiguration(settings.providerConfig);if(current.telegram?.id!==bot.id)throw new ApiError(409,"Bot configuration changed. Retry setup.");await telegramRequest(bot.botToken,"deleteWebhook",{drop_pending_updates:false});current.telegram.webhookReady=true;current.telegram.polling=true;current.telegram.pollError=undefined;await tx.appSettings.update({where:{id:"global"},data:{providerConfig:encryptSecret(JSON.stringify(current))}});return providerSummary(current);},{timeout:20000});return jsonData(summary);
}catch(e){return routeError(e,request);}}
