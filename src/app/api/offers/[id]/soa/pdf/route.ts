import { currentUser } from '@/lib/auth';
import { prisma, tenantDb } from '@/lib/db';
import { statusFor } from '@/lib/payments';
import { soaHtml } from '@/lib/soa-template';
import { renderPdf } from '@/lib/pdf';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await currentUser();
  if (!u?.companyId || (u.role !== 'COMPANY_ADMIN' && u.role !== 'PLATFORM_ADMIN')) return new Response('Admins only', { status: 403 });
  const db = tenantDb(u.companyId);

  const o = await db.offer.findFirst({
    where: { id: params.id },
    select: { clientName: true, clientIdNumber: true, unit: { select: { unitNumber: true, project: { select: { name: true, escrowBank: true, escrowAccountNo: true } } } } },
  });
  if (!o) return new Response('Not found', { status: 404 });

  const payments = await db.payment.findMany({ where: { offerId: params.id }, orderBy: { order: 'asc' } });
  const rows = payments.map((p) => {
    const amount = Number(p.amount), paidAmount = Number(p.paidAmount);
    return { label: p.label, dueDate: p.dueDate, percent: p.percent != null ? Number(p.percent) : null, amount, paidAmount, outstanding: Math.max(0, amount - paidAmount), status: statusFor(amount, paidAmount, p.dueDate) };
  });
  const contracted = rows.reduce((s, r) => s + r.amount, 0);
  const collected = rows.reduce((s, r) => s + r.paidAmount, 0);

  const company = await prisma.company.findUnique({ where: { id: u.companyId }, select: { name: true, brandColor: true, logoUrl: true } });
  let logoDataUri: string | null = null;
  if (company?.logoUrl) {
    const id = company.logoUrl.split('/').pop();
    const a = id ? await db.asset.findFirst({ where: { id }, select: { mime: true, bytes: true } }) : null;
    if (a) logoDataUri = `data:${a.mime};base64,${Buffer.from(a.bytes).toString('base64')}`;
  }

  const html = soaHtml({
    company: { name: company?.name || 'Developer', brandColor: company?.brandColor || '#2563eb', logoDataUri },
    unit: o.unit?.unitNumber || '', project: o.unit?.project?.name || '', client: o.clientName, clientId: o.clientIdNumber,
    escrow: { bank: o.unit?.project?.escrowBank || null, accountNo: o.unit?.project?.escrowAccountNo || null },
    rows, totals: { contracted, collected, outstanding: contracted - collected },
  });
  const pdf = await renderPdf(html);
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="soa-${o.unit?.unitNumber || 'unit'}.pdf"` } });
}
