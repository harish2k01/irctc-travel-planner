import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./http";
import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { getProviderConfiguration, resolveProviderConfiguration, telegramConfigured, type TelegramConfiguration } from "./provider-config";
export const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export const telegramChatHash=(providerId:string,chatId:string)=>tokenHash(`${providerId}:${chatId}`);
export function validWebhookSecret(received:string|null,expected:string){return Boolean(received&&Buffer.byteLength(received)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(received),Buffer.from(expected)));}
export async function telegramRequest<T>(token:string,method:"getMe"|"setWebhook"|"sendMessage",body:object={}):Promise<T>{
 let response:Response;try{response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",redirect:"error",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw new ApiError(502,"Telegram could not be reached. Try again.","TELEGRAM_UNAVAILABLE");}
 const data=await response.json().catch(()=>null);if(!response.ok||!data?.ok)throw new ApiError(502,"Telegram rejected the request. Check the bot token and connection.","TELEGRAM_REJECTED");return data.result as T;
}
export async function sendTelegram(chatId:string,message:string,providerId:string){const config=await getProviderConfiguration();if(!telegramConfigured(config)||config.telegram?.id!==providerId)throw new ApiError(409,"Reconnect Telegram before sending reminders.");const result=await telegramRequest<{message_id:number}>(config.telegram.botToken,"sendMessage",{chat_id:chatId,text:message,link_preview_options:{is_disabled:true}});if(!Number.isSafeInteger(result.message_id))throw new ApiError(502,"Telegram did not confirm the message.");return String(result.message_id);}
export const telegramUpdateSchema=z.object({update_id:z.number().int().nonnegative(),message:z.object({text:z.string().max(4096).optional(),chat:z.object({id:z.number().int().safe(),type:z.string()}),from:z.object({id:z.number().int().safe(),is_bot:z.boolean().optional(),username:z.string().max(100).optional()}).optional()}).optional()});
export async function receiveTelegramUpdate(update:z.infer<typeof telegramUpdateSchema>,config:TelegramConfiguration){
 const message=update.message;if(!message||message.chat.type!=="private"||!message.from||message.from.is_bot||message.from.id!==message.chat.id)return null;
 const chatId=String(message.chat.id),chatHash=telegramChatHash(config.id,chatId),match=message.text?.match(/^\/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{43})$/);
 if(!match&&message.text!=="/stop")return null;
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AppSettings" WHERE id='global' FOR UPDATE`;
  const settings=await tx.appSettings.findUniqueOrThrow({where:{id:"global"}}),current=resolveProviderConfiguration(settings.providerConfig).telegram;
  if(!settings.telegramEnabled||!settings.remindersEnabled||current?.id!==config.id||!current.webhookReady)return null;
  if(message.text==="/stop"){const result=await tx.railTelegram.updateMany({where:{providerId:config.id,chatHash},data:{enabled:false,linkTokenHash:null,linkExpiresAt:null}});return result.count?{method:"sendMessage",chat_id:chatId,text:"Telegram booking reminders are paused. You can reconnect or enable them in RailWatch User Settings."}:null;}
  const connection=await tx.railTelegram.findFirst({where:{providerId:config.id,linkTokenHash:tokenHash(match![1]),linkExpiresAt:{gt:new Date()},user:{isActive:true}}});if(!connection)return null;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${connection.userId} FOR UPDATE`;
  const occupied=await tx.railTelegram.findUnique({where:{chatHash}});if(occupied&&occupied.userId!==connection.userId)return null;
  const claimed=await tx.railTelegram.updateMany({where:{userId:connection.userId,linkTokenHash:connection.linkTokenHash,linkExpiresAt:{gt:new Date()}},data:{chatId:encryptSecret(chatId),chatHash,username:message.from!.username??null,enabled:true,linkTokenHash:null,linkExpiresAt:null}});
  return claimed.count?{method:"sendMessage",chat_id:chatId,text:"Telegram is connected to RailWatch. Booking reminders are enabled using your personal reminder preferences. Send /stop to pause them."}:null;
 });
}
export function telegramRecipient(connection:{chatId:string|null;enabled:boolean;providerId:string}|null,providerId?:string){return connection?.enabled&&connection.providerId===providerId?decryptSecret(connection.chatId)??"":"";}
