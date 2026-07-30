/** Transactional email. Sends via Resend when RESEND_API_KEY is present and
 *  no-ops cleanly otherwise, so the app works before email is configured. */

const FROM = process.env.RESEND_FROM ?? "Roost <onboarding@resend.dev>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export interface SendResult {
  sent: boolean;
  reason?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, reason: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, reason: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "email failed" };
  }
}

const shell = (heading: string, body: string, cta?: { label: string; href: string }) => `
<div style="font-family:-apple-system,Segoe UI,sans-serif;background:#efece1;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <div style="font-size:22px;font-weight:700;color:#2f5d42;margin-bottom:20px">🪺 Roost</div>
    <h1 style="font-size:19px;color:#23291f;margin:0 0 12px">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#4a5148">${body}</div>
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;margin-top:24px;background:#2f5d42;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">${cta.label}</a>`
        : ""
    }
    <p style="margin-top:28px;font-size:12px;color:#7c8173">
      Roost — property finances that organize themselves.
    </p>
  </div>
</div>`;

export function sendInviteEmail(opts: {
  to: string;
  workspaceName: string;
  roleLabel: string;
  inviterName: string;
}): Promise<SendResult> {
  return send(
    opts.to,
    `${opts.inviterName} invited you to ${opts.workspaceName} on Roost`,
    shell(
      `You've been invited to ${opts.workspaceName}`,
      `<p><strong>${opts.inviterName}</strong> has invited you to join their property portfolio on Roost as
       <strong>${opts.roleLabel}</strong>.</p>
       <p>Sign in with this email address and you'll find the invitation waiting in Settings.</p>`,
      { label: "Open Roost", href: `${APP_URL}/settings` }
    )
  );
}

export function sendOverdueRentEmail(opts: {
  to: string;
  name: string;
  count: number;
  total: string;
}): Promise<SendResult> {
  return send(
    opts.to,
    `${opts.count} rent payment${opts.count === 1 ? "" : "s"} overdue`,
    shell(
      "Rent needs chasing",
      `<p>Hi ${opts.name},</p>
       <p>You have <strong>${opts.count}</strong> overdue rent payment${
         opts.count === 1 ? "" : "s"
       } totalling <strong>${opts.total}</strong>.</p>`,
      { label: "Review in Roost", href: `${APP_URL}/income` }
    )
  );
}
