import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError,assertSameOrigin,jsonData,parseJson,routeError } from "@/lib/http";
import { getFeaturePolicy } from "@/lib/settings";
import { getProviderConfiguration,telegramConfigured,telegramLoginConfigured } from "@/lib/provider-config";
import { sendTelegram,telegramRecipient,tokenHash } from "@/lib/telegram";
import { beginTelegramLogin } from "@/lib/telegram-login";
import { enforceRateLimit } from "@/lib/rate-limit";
/** Performs account-bound Telegram pairing, preference, disconnect, or test actions. */
export async function POST(request:Request){try{
 assertSameOrigin(request);const user=await requireUser();await enforceRateLimit(request,"telegram:connection:"+user.id,10,60000);const input=await parseJson(request,z.object({action:z.enum(["authorize","pair","connect","disconnect","enable","pause","test"])}).strict(),1024);
 if(input.action==="disconnect"){await prisma.railTelegram.deleteMany({where:{userId:user.id}});return jsonData({saved:true});}
 const policy=await getFeaturePolicy();if(!policy.telegramEnabled||!policy.remindersEnabled)throw new ApiError(403,"Telegram reminders are disabled by the administrator.");const config=await getProviderConfiguration(),bot=config.telegram;if(!bot||!telegramConfigured(config))throw new ApiError(400,"Telegram setup is incomplete. Ask your administrator.");
 if(input.action==="authorize"){if(!telegramLoginConfigured(config))throw new ApiError(400,"Telegram authorization is not configured. Use Pair With Code, or ask your administrator to add Telegram login credentials.");return jsonData({url:await beginTelegramLogin(user.id,bot)});}
 if(input.action==="pair"){const code=randomBytes(6).toString("hex").toUpperCase(),data={providerId:bot.id,linkTokenHash:tokenHash(code),linkExpiresAt:new Date(Date.now()+600000),authStateHash:null,authPayload:null,authExpiresAt:null};await prisma.railTelegram.upsert({where:{userId:user.id},create:{userId:user.id,...data},update:data});return jsonData({code:code.match(/.{4}/g)!.join("-"),botUsername:bot.botUsername,expiresAt:data.linkExpiresAt});}
 if(input.action==="connect"){const token=randomBytes(32).toString("base64url"),data={providerId:bot.id,linkTokenHash:tokenHash(token),linkExpiresAt:new Date(Date.now()+600000)};await prisma.railTelegram.upsert({where:{userId:user.id},create:{userId:user.id,...data},update:data});return jsonData({url:`https://t.me/${bot.botUsername}?start=${token}`,expiresAt:data.linkExpiresAt});}
 const connection=await prisma.railTelegram.findUnique({where:{userId:user.id}});if(!connection?.chatId||connection.providerId!==bot.id)throw new ApiError(400,"Connect your Telegram account first.");
 if(input.action==="test"){if(!connection.enabled)throw new ApiError(400,"Enable Telegram reminders before testing.");await sendTelegram(telegramRecipient(connection,bot.id),"🚆 RailWatch · Connection Test\n\nYour Telegram connection is working. Booking reminders will follow your personal reminder preferences.",bot.id);return jsonData({saved:true});}
 await prisma.railTelegram.update({where:{userId:user.id},data:{enabled:input.action==="enable"}});return jsonData({saved:true});
}catch(e){return routeError(e,request);}}
