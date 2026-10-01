import { assertCronSecret } from "@/lib/auth";
import { jsonData,routeError } from "@/lib/http";
import { processRailplan } from "@/lib/railplan-jobs";
export const maxDuration=300;
export async function POST(request:Request){try{assertCronSecret(request);return jsonData(await processRailplan());}catch(e){return routeError(e,request);}}
