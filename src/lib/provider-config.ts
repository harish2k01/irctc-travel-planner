import { z } from "zod";
import { randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto";
import { getAppSettings } from "./settings";
import { ApiError } from "./http";

export type GoogleConfiguration = { clientId: string; clientSecret: string; id: string };
export type WhatsAppConfiguration = { accessToken: string; phoneNumberId: string; apiVersion: string; templateName: string; language: string };
export type ProviderConfiguration = { google?: GoogleConfiguration | null; whatsapp?: WhatsAppConfiguration | null };
const secret = z.string().trim().min(1).max(4096).refine(value=>!/[\x00-\x1f\x7f]/.test(value),"Remove line breaks from the credential.").optional();
export const providerUpdateSchema = z.object({
  google: z.object({clientId:z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/),clientSecret:secret}).strict().nullable().optional(),
  whatsapp:z.object({accessToken:secret,phoneNumberId:z.string().regex(/^\d{1,30}$/),apiVersion:z.string().regex(/^v\d{1,3}\.\d{1,2}$/),templateName:z.string().regex(/^[a-z0-9_]{1,512}$/),language:z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/)}).strict().nullable().optional(),
}).strict().refine(v=>v.google!==undefined||v.whatsapp!==undefined,"Choose a provider to update.");

export function resolveProviderConfiguration(payload: string | null, env: Record<string,string|undefined> = process.env): ProviderConfiguration {
  const saved:ProviderConfiguration=payload?JSON.parse(decryptSecret(payload)!):{};
  return {
    google:saved.google!==undefined?saved.google:env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET?{clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,id:"environment"}:null,
    whatsapp:saved.whatsapp!==undefined?saved.whatsapp:env.WHATSAPP_ACCESS_TOKEN?{accessToken:env.WHATSAPP_ACCESS_TOKEN,phoneNumberId:env.WHATSAPP_PHONE_NUMBER_ID??"",apiVersion:env.WHATSAPP_API_VERSION??"",templateName:env.WHATSAPP_TEMPLATE_NAME??"",language:env.WHATSAPP_TEMPLATE_LANGUAGE??"en"}:null,
  };
}
export async function getProviderConfiguration(){return resolveProviderConfiguration((await getAppSettings()).providerConfig);}
export function googleConfigured(c:ProviderConfiguration){return Boolean(c.google?.clientId&&c.google.clientSecret&&process.env.APP_URL);}
export function whatsappConfigured(c:ProviderConfiguration){return Boolean(c.whatsapp?.accessToken&&/^\d+$/.test(c.whatsapp.phoneNumberId)&&/^v\d+\.\d+$/.test(c.whatsapp.apiVersion)&&c.whatsapp.templateName);}
export function providerSummary(c:ProviderConfiguration){return {google:{clientId:c.google?.clientId??"",configured:googleConfigured(c),secretStored:Boolean(c.google?.clientSecret),redirectUri:process.env.APP_URL?new URL("/api/railwatch/google/callback",process.env.APP_URL).href:""},whatsapp:{phoneNumberId:c.whatsapp?.phoneNumberId??"",apiVersion:c.whatsapp?.apiVersion??"",templateName:c.whatsapp?.templateName??"",language:c.whatsapp?.language??"en",configured:whatsappConfigured(c),tokenStored:Boolean(c.whatsapp?.accessToken)}};}
export function updateProviderConfiguration(current:ProviderConfiguration,input:z.infer<typeof providerUpdateSchema>){
  const next={...current};
  if(input.google!==undefined){if(input.google===null)next.google=null;else{if(input.google.clientId!==current.google?.clientId&&!input.google.clientSecret)throw new ApiError(400,"Enter the client secret for this Google client.");const clientSecret=input.google.clientSecret??current.google?.clientSecret;if(!clientSecret)throw new ApiError(400,"Enter the Google client secret.");const changed=input.google.clientId!==current.google?.clientId||clientSecret!==current.google?.clientSecret;next.google={clientId:input.google.clientId,clientSecret,id:changed?randomUUID():current.google!.id};}}
  if(input.whatsapp!==undefined){if(input.whatsapp===null)next.whatsapp=null;else{const accessToken=input.whatsapp.accessToken??current.whatsapp?.accessToken;if(!accessToken)throw new ApiError(400,"Enter the WhatsApp access token.");next.whatsapp={...input.whatsapp,accessToken};}}
  return {next,payload:encryptSecret(JSON.stringify(next)),googleChanged:next.google?.id!==current.google?.id};
}
