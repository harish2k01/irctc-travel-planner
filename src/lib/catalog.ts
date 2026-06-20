import { prisma } from "@/lib/db";
import { routes, trains } from "@/lib/seed-data";

export async function provisionUserCatalog(userId: string) {
  for (const route of routes) {
    await prisma.route.upsert({
      where: { id: `${userId}-${route.id}` },
      update: {
        originCode: route.originCode,
        originName: route.originName,
        destinationCode: route.destinationCode,
        destinationName: route.destinationName,
      },
      create: {
        id: `${userId}-${route.id}`,
        userId,
        originCode: route.originCode,
        originName: route.originName,
        destinationCode: route.destinationCode,
        destinationName: route.destinationName,
      },
    });
  }

  for (const train of trains) {
    await prisma.train.upsert({
      where: { id: `${userId}-${train.id}` },
      update: {
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        preferredClasses: train.preferredClasses,
      },
      create: {
        id: `${userId}-${train.id}`,
        routeId: `${userId}-${train.routeId}`,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        preferredClasses: train.preferredClasses,
      },
    });
  }
}
