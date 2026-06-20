import nodemailer from "nodemailer";

export async function sendTemporaryPasswordEmail(email: string, temporaryPassword: string) {
  if (!process.env.SMTP_URL) {
    return { sent: false, reason: "SMTP_URL is not configured." };
  }

  const transporter = nodemailer.createTransport(process.env.SMTP_URL);
  const from = process.env.EMAIL_FROM ?? "IRCTC Travel Planner <noreply@example.com>";

  await transporter.sendMail({
    from,
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
