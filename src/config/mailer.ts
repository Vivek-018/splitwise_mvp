import nodemailer from "nodemailer";

export const createMailTransport = () => {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER ?? "",
            pass: process.env.SMTP_PASS ?? "",
          }
        : undefined,
  });
};
