import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
export async function getAppSettings(){await prisma.appSettings.createMany({data:[{id:"global"}],skipDuplicates:true});return prisma.appSettings.findUniqueOrThrow({where:{id:"global"}});}
export async function getDeliveryConfiguration(){const settings=await getAppSettings();return {...settings,smtpUrl:decryptSecret(settings.smtpUrl)??process.env.SMTP_URL,emailFrom:settings.emailFrom??process.env.EMAIL_FROM??"RailWatch <noreply@example.com>"};}

import type { FeaturePolicy } from "./feature-policy";
export function publicPolicy(s:Omit<FeaturePolicy,"weekStartsOn"|"routineHorizonMode">&{weekStartsOn:number;routineHorizonMode:string}):FeaturePolicy{return {weekStartsOn:s.weekStartsOn===1?1:0,routineHorizonMode:s.routineHorizonMode==="count"?"count":"months",routineMonthsAhead:s.routineMonthsAhead,routineTicketCount:s.routineTicketCount,allowSignups:s.allowSignups,bookingWindowDays:s.bookingWindowDays,remindersEnabled:s.remindersEnabled,telegramEnabled:s.telegramEnabled,whatsappEnabled:s.whatsappEnabled,googleCalendarEnabled:s.googleCalendarEnabled,ticketUploadsEnabled:s.ticketUploadsEnabled,calendarExportEnabled:s.calendarExportEnabled};}
export async function getFeaturePolicy(){return publicPolicy(await getAppSettings());}
