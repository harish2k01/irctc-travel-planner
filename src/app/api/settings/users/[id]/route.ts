import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, assertSameOrigin, jsonData, parseJson, routeError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
});

async function protectLastAdmin(id: string, role?: "ADMIN" | "USER", isActive?: boolean) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, "User not found.", "NOT_FOUND");
  if (target.role === "ADMIN" && (role === "USER" || isActive === false)) {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (adminCount <= 1) throw new ApiError(400, "At least one active administrator is required.", "LAST_ADMIN");
  }
  return target;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    const input = await parseJson(request, schema);
    if (id === admin.id && input.isActive === false) throw new ApiError(400, "You cannot deactivate your own account.", "SELF_UPDATE");
    await protectLastAdmin(id, input.role, input.isActive);
    const user = await prisma.user.update({
      where: { id },
      data: input,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    await writeAudit({ actorId: admin.id, action: "user.updated", targetType: "User", targetId: id, metadata: { fields: Object.keys(input) }, request });
    return jsonData({ ...user, name: user.name ?? undefined, createdAt: user.createdAt.toISOString() });
  } catch (error) {
    return routeError(error, request);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) throw new ApiError(400, "You cannot delete your own account.", "SELF_UPDATE");
    await protectLastAdmin(id, "USER", false);
    const result = await prisma.user.deleteMany({ where: { id } });
    if (result.count !== 1) throw new ApiError(404, "User not found.", "NOT_FOUND");
    await writeAudit({ actorId: admin.id, action: "user.deleted", targetType: "User", targetId: id, request });
    return jsonData({ id });
  } catch (error) {
    return routeError(error, request);
  }
}
