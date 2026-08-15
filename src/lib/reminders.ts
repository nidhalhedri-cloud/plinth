import 'server-only';
import type { TenantClient } from './db';
import { hasSmtp, sendMail, type SmtpCompany } from './email';

const money = (n: number) => 'AED ' + Math.round(n).toLocaleString('en-AE');
const fdate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const COOLDOWN_MS = 3 * 864e5; // don't re-remind the same installment within 3 days

function reminderHtml(c: SmtpCompany, unit: string, project: string, label: string, outstanding: number, due: Date, overdue: boolean): string {
  const brand = c.brandColor || '#2563eb';
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
  <div style="background:${brand};color:#fff;padding:18px 24px;border-radius:10px 10px 0 0"><b>${c.fromName || c.name}</b></div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 10px 10px">
    <p>Dear valued client,</p>
    <p>This is a ${overdue ? '<b style="color:#dc2626">payment overdue</b>' : 'friendly payment'} reminder for your unit <b>${unit}</b> at <b>${project}</b>.</p>
    <table style="width:100%;font-size:14px;margin:14px 0;border-collapse:collapse">
      <tr><td style="color:#64748b;padding:4px 0">Installment</td><td style="text-align:right">${label}</td></tr>
      <tr><td style="color:#64748b;padding:4px 0">Due date</td><td style="text-align:right">${fdate(due)}</td></tr>
      <tr><td style="color:#64748b;padding:4px 0">Amount due</td><td style="text-align:right;font-weight:700;color:${brand}">${money(outstanding)}</td></tr>
    </table>
    <p style="font-size:13px;color:#475569">Kindly arrange the payment to the project escrow account. If you have already paid, please disregard this message.</p>
    <p style="font-size:13px;color:#94a3b8">${c.name}</p>
  </div></div>`;
}

// Send payment reminders for overdue / soon-due unpaid installments (skips paid ones and respects a
// cooldown so a buyer isn't spammed). Returns counts; when SMTP isn't set it still reports how many
// buyers WOULD be reminded.
export async function runReminders(db: TenantClient, company: SmtpCompany & { reminderDaysBefore?: number | null }) {
  const soon = Date.now() + (company.reminderDaysBefore ?? 7) * 864e5;
  const payments = await db.payment.findMany({
    where: { status: { not: 'PAID' } },
    include: { offer: { select: { clientEmail: true, unit: { select: { unitNumber: true, project: { select: { name: true } } } } } } },
  });

  let candidates = 0, sent = 0, failed = 0, noEmail = 0;
  const configured = hasSmtp(company);

  for (const p of payments) {
    const outstanding = Number(p.amount) - Number(p.paidAmount);
    if (outstanding <= 0.5 || !p.dueDate) continue;                 // paid or undated → skip
    if (new Date(p.dueDate).getTime() > soon) continue;             // not due soon yet
    if (p.lastReminderAt && Date.now() - new Date(p.lastReminderAt).getTime() < COOLDOWN_MS) continue;
    const email = p.offer.clientEmail;
    if (!email) { noEmail++; continue; }
    candidates++;
    if (!configured) continue;

    const due = new Date(p.dueDate);
    const overdue = due.getTime() < Date.now();
    try {
      await sendMail(company, email, `${overdue ? 'Overdue' : 'Upcoming'} payment — Unit ${p.offer.unit?.unitNumber}`,
        reminderHtml(company, p.offer.unit?.unitNumber || '', p.offer.unit?.project?.name || '', p.label, outstanding, due, overdue));
      await db.payment.updateMany({ where: { id: p.id }, data: { lastReminderAt: new Date() } });
      sent++;
    } catch { failed++; }
  }
  return { candidates, sent, failed, noEmail, emailConfigured: configured };
}
