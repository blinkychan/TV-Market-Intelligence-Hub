import { logOperationalEvent } from "@/lib/ops-log";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = {
  simulated: boolean;
  provider: "resend" | "preview";
  messageId: string | null;
  preview: { to: string[]; subject: string; html: string; text: string } | null;
};

function getRecipients(to: string | string[]) {
  return Array.from(new Set((Array.isArray(to) ? to : [to]).map((value) => value.trim()).filter(Boolean)));
}

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.REPORT_FROM_EMAIL?.trim());
}

export function renderEmailHtml(args: { title: string; intro: string; bodyMarkdown: string; appUrl?: string | null }) {
  const bodyHtml = args.bodyMarkdown
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<br />";
      if (line.startsWith("# ")) return `<h1 style="font-size:24px;margin:0 0 16px;">${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2 style="font-size:18px;margin:24px 0 10px;">${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("- ")) return `<div style="margin:0 0 8px 0;">• ${escapeHtml(line.slice(2))}</div>`;
      return `<p style="margin:0 0 12px;line-height:1.55;">${escapeHtml(line)}</p>`;
    })
    .join("");

  const appLink = args.appUrl ? `<p style="margin-top:24px;"><a href="${args.appUrl}" style="color:#0f766e;text-decoration:none;font-weight:600;">Open TV Market Intelligence Hub</a></p>` : "";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:760px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(15,23,42,0.06);">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0f766e;">TV Market Intelligence Hub</div>
        <h1 style="font-size:28px;line-height:1.15;margin:12px 0 10px;">${escapeHtml(args.title)}</h1>
        <p style="margin:0 0 24px;color:#475569;line-height:1.6;">${escapeHtml(args.intro)}</p>
        ${bodyHtml}
        ${appLink}
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const recipients = getRecipients(message.to);
  const preview = {
    to: recipients,
    subject: message.subject,
    html: message.html,
    text: message.text
  };

  if (!emailDeliveryConfigured()) {
    logOperationalEvent("info", "Email delivery simulated.", {
      toCount: recipients.length,
      subject: message.subject,
      provider: "preview"
    });
    return {
      simulated: true,
      provider: "preview",
      messageId: null,
      preview
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.REPORT_FROM_EMAIL,
      to: recipients,
      subject: message.subject,
      html: message.html,
      text: message.text
    }),
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) {
    const details = response ? await response.text().catch(() => "") : "No response from Resend";
    logOperationalEvent("warn", "Email delivery failed; returning preview payload.", {
      toCount: recipients.length,
      subject: message.subject,
      details
    });
    return {
      simulated: true,
      provider: "preview",
      messageId: null,
      preview
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  logOperationalEvent("info", "Email delivered.", {
    toCount: recipients.length,
    subject: message.subject,
    provider: "resend"
  });

  return {
    simulated: false,
    provider: "resend",
    messageId: payload?.id ?? null,
    preview: null
  };
}
