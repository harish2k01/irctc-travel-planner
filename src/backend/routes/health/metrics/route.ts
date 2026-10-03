import { assertCronSecret } from "@/lib/auth";
import { noStoreHeaders,routeError } from "@/lib/http";
import { reminderHealth,reminderMetrics } from "@/lib/reminder-operations";

/** Serves aggregate operational metrics to authenticated monitoring clients only. */
export async function GET(request:Request) {
  try {
    assertCronSecret(request);
    return new Response(reminderMetrics(await reminderHealth()),{headers:{...noStoreHeaders(),"Content-Type":"text/plain; version=0.0.4; charset=utf-8"}});
  }catch(error){return routeError(error,request);}
}
