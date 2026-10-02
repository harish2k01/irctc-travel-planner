import { getProviderConfiguration, telegramConfigured } from "@/lib/provider-config";
import { getFeaturePolicy } from "@/lib/settings";
import { parseJson,routeError } from "@/lib/http";
import { receiveTelegramUpdate,telegramUpdateSchema,validWebhookSecret } from "@/lib/telegram";
export async function POST(request:Request){try{const config=await getProviderConfiguration();if(!config.telegram||!validWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"),config.telegram.webhookSecret))return Response.json({ok:false},{status:403});const policy=await getFeaturePolicy();if(!policy.telegramEnabled||!policy.remindersEnabled||!telegramConfigured(config))return Response.json({ok:true});const update=await parseJson(request,telegramUpdateSchema,65536);return Response.json(await receiveTelegramUpdate(update,config.telegram)??{ok:true});}catch(e){return routeError(e,request);}}
