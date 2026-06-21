import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });
const previousSampleTrainNumbers = ["12624", "12028", "12128", "12796"];

async function main() {
  await prisma.appSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", allowSignups: true },
  });

  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: "demo-user" },
        { email: "demo@commuterail.in" },
      ],
    },
  });

  await prisma.train.deleteMany({
    where: {
      trainNumber: { in: previousSampleTrainNumbers },
      journeys: { none: {} },
    },
  });

  await prisma.route.deleteMany({
    where: {
      trains: { none: {} },
      journeys: { none: {} },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
