/**
 * Envio de e-mails reais via SMTP (qualquer provedor: Resend, SES, Brevo, Gmail Workspace...).
 * Sem SMTP_URL configurada, nada é enviado e o retorno é "skipped" — nunca fingimos o envio.
 */
export type EmailResult = "sent" | "skipped" | "failed";

export function emailConfigured() {
  return !!process.env.SMTP_URL && !!process.env.EMAIL_FROM;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<EmailResult> {
  if (!emailConfigured()) return "skipped";
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(process.env.SMTP_URL);
    await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
    return "sent";
  } catch (err) {
    console.error("[email] falha no envio:", (err as Error).message);
    return "failed";
  }
}

export function emailLayout(title: string, body: string, cta?: { label: string; url: string }) {
  const safe = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  return `<!doctype html><html><body style="margin:0;background:#F6F2F1;font-family:Arial,sans-serif;color:#1F1F23">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="border-top:4px solid #8B1022;background:#fff;padding:32px">
      <h1 style="font-family:Georgia,serif;font-weight:400;color:#0A4F53;margin:0 0 16px">${safe(title)}</h1>
      <div style="font-size:15px;line-height:1.6;white-space:pre-line">${safe(body)}</div>
      ${cta ? `<p style="margin-top:28px"><a href="${cta.url}" style="background:#701A2E;color:#fff;padding:12px 22px;text-decoration:none;border-radius:999px">${safe(cta.label)}</a></p>` : ""}
    </div>
  </div></body></html>`;
}
