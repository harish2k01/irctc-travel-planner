import nodemailer from "nodemailer";
import { getDeliveryConfiguration } from "@/lib/settings";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function send(to: string, subject: string, text: string) {
  const config = await getDeliveryConfiguration();
  if (!config.smtpUrl) return { sent: false as const, reason: "Email delivery is not configured." };
  const transporter = nodemailer.createTransport(config.smtpUrl, {
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transporter.sendMail({ from: config.emailFrom, to, subject, text });
  return { sent: true as const };
}

export function sendInvitationEmail(email: string, token: string) {
  const url = `${appUrl()}/set-password?token=${encodeURIComponent(token)}&type=invitation`;
  return send(email, "Set up your IRCTC Travel Planner account", [
    "An administrator created an IRCTC Travel Planner account for you.",
    "",
    `Set your password using this one-time link: ${url}`,
    "",
    "The link expires in 24 hours.",
  ].join("\n"));
}

export function sendPasswordResetEmail(email: string, token: string) {
  const url = `${appUrl()}/set-password?token=${encodeURIComponent(token)}&type=reset`;
  return send(email, "Reset your IRCTC Travel Planner password", [
    "A password reset was requested for your account.",
    "",
    `Choose a new password using this one-time link: ${url}`,
    "",
    "The link expires in 30 minutes. Ignore this message if you did not request it.",
  ].join("\n"));
}

export function sendReminderEmail(input: { email: string; route: string; travelDate: string; bookingDate: string; message: string }) {
  return send(input.email, `Booking reminder: ${input.route}`, [
    input.message,
    "",
    `Route: ${input.route}`,
    `Travel date: ${input.travelDate}`,
    `Booking date: ${input.bookingDate}`,
    "",
    `${appUrl()}/tracker`,
  ].join("\n"));
}
