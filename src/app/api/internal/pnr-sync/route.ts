import { assertCronSecret } from "@/lib/auth";
import { jsonData, routeError } from "@/lib/http";
import { syncDuePnrs } from "@/lib/pnr-sync";

export async function POST(request: Request) {
  try {
    assertCronSecret(request);
    return jsonData(await syncDuePnrs());
  } catch (error) {
    return routeError(error, request);
  }
}
