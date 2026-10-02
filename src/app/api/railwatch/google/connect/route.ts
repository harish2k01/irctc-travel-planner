import { getFeaturePolicy } from "@/lib/settings";
import { cookies } from "next/headers";
import { randomBytes,createHash } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { ApiError,assertSameOrigin,jsonData,routeError } from "@/lib/http";
import { googleReady,googleRedirect } from "@/lib/railplan-google";
import { encryptSecret } from "@/lib/crypto";
export async function POST(request:Request){try{assertSameOrigin(request);const user=await requireUser();if(!(await getFeaturePolicy()).googleCalendarEnabled)throw new ApiError(403,"Google Calendar is disabled by the administrator.","FEATURE_DISABLED");if(!googleReady())throw new ApiError(503,"Google Calendar has not been configured by the administrator.");const state=randomBytes(32).toString("base64url"),verifier=randomBytes(32).toString("base64url");(await cookies()).set("railwatch_oauth",encryptSecret(JSON.stringify({state,verifier,userId:user.id})),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:600,path:"/api/railwatch/google"});const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:googleRedirect(),response_type:"code",scope:"https://www.googleapis.com/auth/calendar.app.created",access_type:"offline",prompt:"consent",state,code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"}).toString();return jsonData({url:url.href});}catch(e){return routeError(e,request);}}
