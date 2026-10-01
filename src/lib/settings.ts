import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
export async function getAppSettings(){await prisma.appSettings.createMany({data:[{id:"global"}],skipDuplicates:true});return prisma.appSettings.findUniqueOrThrow({where:{id:"global"}});}
export async function getDeliveryConfiguration(){const settings=await getAppSettings();return {...settings,smtpUrl:decryptSecret(settings.smtpUrl)??process.env.SMTP_URL,emailFrom:settings.emailFrom??process.env.EMAIL_FROM??"Railplan <noreply@example.com>"};}
