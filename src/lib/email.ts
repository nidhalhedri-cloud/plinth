import 'server-only';

export type SmtpCompany = {
  name: string; brandColor?: string | null;
  smtpHost?: string | null; smtpPort?: number | null; smtpUser?: string | null; smtpPass?: string | null;
  fromEmail?: string | null; fromName?: string | null;
};

export function hasSmtp(c: SmtpCompany): boolean {
  return !!(c.smtpHost && c.fromEmail);
}

// Send via the developer's OWN SMTP mailbox. nodemailer is dynamically imported so it stays server-side.
export async function sendMail(c: SmtpCompany, to: string, subject: string, html: string): Promise<void> {
  if (!hasSmtp(c)) throw new Error('Email is not configured');
  const nodemailer = (await import('nodemailer')).default;
  const port = c.smtpPort || 587;
  const transport = nodemailer.createTransport({
    host: c.smtpHost!, port, secure: port === 465,
    auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPass || '' } : undefined,
  });
  await transport.sendMail({ from: `${c.fromName || c.name} <${c.fromEmail}>`, to, subject, html });
}
