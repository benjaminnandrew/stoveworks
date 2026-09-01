import "server-only";

import { business } from "@/content/site";

/**
 * Transactional email.
 *
 * Production sets SMTP_URL (e.g. smtps://user:pass@smtp.host:465) and MAIL_FROM.
 * Without SMTP_URL — local development — messages are written to the server
 * console instead, so the magic-link flow is fully testable offline.
 */

type Message = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const from = process.env.MAIL_FROM ?? `${business.name} <${business.email}>`;

let transportPromise: Promise<import("nodemailer").Transporter> | null = null;

function transport() {
  if (!transportPromise) {
    transportPromise = import("nodemailer").then((nodemailer) =>
      nodemailer.createTransport(process.env.SMTP_URL!),
    );
  }
  return transportPromise;
}

export async function sendMail(message: Message): Promise<void> {
  if (!process.env.SMTP_URL) {
    console.log(
      [
        "",
        "──────────── email (dev: SMTP_URL not set) ────────────",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "───────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }

  await (await transport()).sendMail({ from, ...message });
}

export function signInEmail(link: string, isNew: boolean): Omit<Message, "to"> {
  const greeting = isNew
    ? `Welcome to ${business.shortName}. Use the link below to finish setting up your account.`
    : `Use the link below to sign in to your ${business.shortName} account.`;

  return {
    subject: `Your ${business.shortName} sign-in link`,
    text: [
      greeting,
      "",
      link,
      "",
      "This link works once and expires in 15 minutes.",
      "If you didn't ask for it, you can ignore this email.",
      "",
      `${business.name}`,
      `${business.street}, ${business.city}, ${business.state} ${business.zip}`,
      business.phone,
    ].join("\n"),
    html: `
<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px">
  <p style="margin:0 0 18px">${greeting}</p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#d63d45;color:#fff;padding:12px 22px;font-weight:700;text-decoration:none">Sign in</a>
  </p>
  <p style="margin:0 0 6px;color:#666;font-size:13px">Or paste this into your browser:</p>
  <p style="margin:0 0 24px;word-break:break-all;font-size:13px"><a href="${link}" style="color:#d63d45">${link}</a></p>
  <p style="margin:0 0 24px;color:#666;font-size:13px">
    This link works once and expires in 15 minutes.<br>
    If you didn't ask for it, you can ignore this email.
  </p>
  <hr style="border:0;border-top:1px solid #e2e2e2;margin:0 0 16px">
  <p style="margin:0;color:#666;font-size:13px">
    <strong>${business.name}</strong><br>
    ${business.street}, ${business.city}, ${business.state} ${business.zip}<br>
    ${business.phone}
  </p>
</div>`.trim(),
  };
}
