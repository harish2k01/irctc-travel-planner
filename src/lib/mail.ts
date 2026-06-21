import nodemailer from "nodemailer";
import { getAppSettings } from "@/lib/settings";

async function getMailConfig() {
  const settings = await getAppSettings();

  return {
    smtpUrl: settings.smtpUrl ?? process.env.SMTP_URL,
    emailFrom: settings.emailFrom ?? process.env.EMAIL_FROM ?? "IRCTC Travel Planner <noreply@example.com>",
  };
}

export async function sendTemporaryPasswordEmail(email: string, temporaryPassword: string) {
  const { smtpUrl, emailFrom } = await getMailConfig();

  if (!smtpUrl) {
    return { sent: false, reason: "SMTP URL is not configured." };
  }

  const transporter = nodemailer.createTransport(smtpUrl);

  await transporter.sendMail({
    from: emailFrom,
    to: email,
    subject: "Your IRCTC Travel Planner temporary password",
    text: [
      "An administrator created an IRCTC Travel Planner account for you.",
      "",
      `Temporary password: ${temporaryPassword}`,
      "",
      "Sign in with this password and set a new password when prompted.",
    ].join("\n"),
  });

  return { sent: true };
}

export async function sendPasswordResetEmail(email: string, temporaryPassword: string) {
  const { smtpUrl, emailFrom } = await getMailConfig();

  if (!smtpUrl) {
    return { sent: false, reason: "SMTP URL is not configured." };
  }

  const transporter = nodemailer.createTransport(smtpUrl);

  await transporter.sendMail({
    from: emailFrom,
    to: email,
    subject: "Reset your IRCTC Travel Planner password",
    text: [
      "A password reset was requested for your IRCTC Travel Planner account.",
      "",
      `Temporary password: ${temporaryPassword}`,
      "",
      "Sign in with this temporary password. You will be asked to set a new password immediately.",
      "",
      "If you did not request this, contact your administrator.",
    ].join("\n"),
  });

  return { sent: true };
}
