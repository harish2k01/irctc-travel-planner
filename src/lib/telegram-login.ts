import { randomBytes,createHash } from "node:crypto";
import { createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey } from "jose";
import { prisma } from "./db";
import { encryptSecret,decryptSecret } from "./crypto";
import { ApiError } from "./http";
import { getProviderConfiguration,telegramLoginConfigured,telegramLoginRedirect,type TelegramConfiguration } from "./provider-config";
import { tokenHash,bindTelegramAccount } from "./telegram";
const keys=createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"),{timeoutDuration:10000});
/** Identifies the configured Telegram authorization credentials without retaining them in browser state. */
export function loginCredentialHash(bot:TelegramConfiguration){return tokenHash(`${bot.clientId}:${bot.clientSecret}`);}
/** Builds Telegram authorization parameters for the current instance. */
export function authorizationDetails(bot:TelegramConfiguration){
  const state=randomBytes(32).toString("base64url"),verifier=randomBytes(32).toString("base64url"),nonce=randomBytes(32).toString("base64url");
  const url=new URL("https://oauth.telegram.org/auth");
  url.search=new URLSearchParams({client_id:bot.clientId!,redirect_uri:telegramLoginRedirect(),response_type:"code",scope:"openid profile telegram:bot_access",state,nonce,code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"}).toString();
  return {url:url.href,state,verifier,nonce};
}
/** Creates a short-lived account-bound authorization flow with anti-replay state. */
export async function beginTelegramLogin(userId:string,bot:TelegramConfiguration){
  const details=authorizationDetails(bot),data={providerId:bot.id,linkTokenHash:null,linkExpiresAt:null,authStateHash:tokenHash(details.state),authExpiresAt:new Date(Date.now()+600000),authPayload:encryptSecret(JSON.stringify({verifier:details.verifier,nonce:details.nonce,credentialHash:loginCredentialHash(bot)}))};
  await prisma.railTelegram.upsert({where:{userId},create:{userId,...data},update:data});
  return details.url;
}
/** Verifies Telegram identity tokens against the provider signing keys and expected claims. */
export async function verifyTelegramIdentity(token:string,bot:TelegramConfiguration,nonce:string,key:JWTVerifyGetKey=keys){
  const {payload}=await jwtVerify(token,key,{issuer:"https://oauth.telegram.org",audience:bot.clientId!,algorithms:["RS256"],requiredClaims:["exp","iat","sub","nonce","id"],maxTokenAge:"10m"});
  if(payload.nonce!==nonce||typeof payload.sub!=="string"||!payload.sub.length||payload.sub.length>256)throw new Error("Invalid Telegram identity");
  // The OpenID subject is opaque; the signed profile id is the Bot API chat id.
  const id=payload.id;
  if(!((typeof id==="number"&&Number.isSafeInteger(id)&&id>0)||(typeof id==="string"&&/^\d{1,16}$/.test(id)&&Number.isSafeInteger(Number(id))&&Number(id)>0)))throw new Error("Invalid Telegram chat");
  return {chatId:String(id),username:typeof payload.preferred_username==="string"?payload.preferred_username.slice(0,100):null};
}
/** Consumes the account-bound authorization flow and links the verified Telegram identity. */
export async function completeTelegramLogin(userId:string,state:string,code:string){
  const config=await getProviderConfiguration(),bot=config.telegram;
  if(!bot||!telegramLoginConfigured(config)||! /^[A-Za-z0-9_-]{43}$/.test(state)||!code||code.length>4096)throw new ApiError(400,"Telegram authorization expired. Try connecting again.");
  const pending=await prisma.railTelegram.findUnique({where:{userId}});
  if(pending?.providerId!==bot.id||pending.authStateHash!==tokenHash(state)||!pending.authPayload||!pending.authExpiresAt||pending.authExpiresAt<=new Date())throw new ApiError(400,"Telegram authorization expired. Try connecting again.");
  const claimed=await prisma.railTelegram.updateMany({where:{userId,authStateHash:pending.authStateHash,authExpiresAt:{gt:new Date()}},data:{authStateHash:null,authPayload:null,authExpiresAt:null}});
  if(!claimed.count)throw new Error("Authorization already used");
  const saved=JSON.parse(decryptSecret(pending.authPayload)!);
  if(saved.credentialHash!==loginCredentialHash(bot))throw new Error("Login configuration changed");
  const response=await fetch("https://oauth.telegram.org/token",{method:"POST",redirect:"error",headers:{Authorization:"Basic "+Buffer.from(`${bot.clientId}:${bot.clientSecret}`).toString("base64"),"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:telegramLoginRedirect(),client_id:bot.clientId!,code_verifier:saved.verifier}),signal:AbortSignal.timeout(15000)});
  const tokens=await response.json().catch(()=>null);if(!response.ok||typeof tokens?.id_token!=="string")throw new Error("Telegram authorization failed");
  const identity=await verifyTelegramIdentity(tokens.id_token,bot,saved.nonce);
  await bindTelegramAccount(userId,identity.chatId,identity.username,bot,loginCredentialHash(bot));
}
