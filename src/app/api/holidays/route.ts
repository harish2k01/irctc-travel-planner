import { randomUUID } from "crypto";
import { createHolidaySchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, noStoreHeaders, parseJson, routeError } from "@/lib/http";

function serializeHoliday(value: { id: string; name: string; date: Date; type: "COMPANY" | "PERSONAL_LEAVE" }) {
  return { id: value.id, name: value.name, date: value.date.toISOString().slice(0, 10), type: value.type };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const rows = await prisma.holiday.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, take: 500 });
    return Response.json({ data: rows.map(serializeHoliday) }, { headers: noStoreHeaders() });
  } catch (error) {
    return routeError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await parseJson(request, createHolidaySchema);
    const holiday = await prisma.holiday.create({
      data: { id: randomUUID(), userId: user.id, name: input.name, date: new Date(`${input.date}T00:00:00.000Z`), type: input.type },
    });
    await writeAudit({ actorId: user.id, action: "holiday.created", targetType: "Holiday", targetId: holiday.id, request });
    return Response.json({ data: serializeHoliday(holiday) }, { status: 201 });
  } catch (error) {
    return routeError(error, request);
  }
}
