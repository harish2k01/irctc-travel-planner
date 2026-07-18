import { createHolidaySchema } from "@/lib/api-schemas";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";

const updateSchema = createHolidaySchema.partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(request, updateSchema);
    const existing = await prisma.holiday.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new ApiError(404, "Holiday not found.", "NOT_FOUND");
    const holiday = await prisma.holiday.update({
      where: { id },
      data: { name: input.name, type: input.type, date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : undefined },
    });
    await writeAudit({ actorId: user.id, action: "holiday.updated", targetType: "Holiday", targetId: id, request });
    return jsonData({ ...holiday, date: holiday.date.toISOString().slice(0, 10) });
  } catch (error) {
    return routeError(error, request);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const result = await prisma.holiday.deleteMany({ where: { id, userId: user.id } });
    if (result.count !== 1) throw new ApiError(404, "Holiday not found.", "NOT_FOUND");
    await writeAudit({ actorId: user.id, action: "holiday.deleted", targetType: "Holiday", targetId: id, request });
    return jsonData({ id });
  } catch (error) {
    return routeError(error, request);
  }
}
