import { assertCronSecret } from "@/lib/auth";
import { jsonData, routeError } from "@/lib/http";
import { processReminders } from "@/lib/reminders";

export async function POST(request: Request) {
  try {
    assertCronSecret(request);
    return jsonData(await processReminders());
  } catch (error) {
    return routeError(error, request);
  }
}
