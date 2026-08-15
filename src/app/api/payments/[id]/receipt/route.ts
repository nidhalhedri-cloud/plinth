import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { statusFor } from '@/lib/payments';

export const runtime = 'nodejs';

const Receipt = z.object({
  amount: z.number().positive(),
  paidAt: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

// Record a receipt against an installment (ADMIN). Additive — supports partial payments.
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const b = Receipt.parse(await req.json());

    const p = await db.payment.findFirst({ where: { id: params.id }, select: { amount: true, paidAmount: true, dueDate: true, method: true, reference: true } });
    if (!p) throw new HttpError(404, 'Installment not found');

    const amount = Number(p.amount);
    const newPaid = Number(p.paidAmount) + b.amount;
    await db.payment.updateMany({
      where: { id: params.id },
      data: {
        paidAmount: newPaid,
        paidAt: b.paidAt ? new Date(b.paidAt) : new Date(),
        method: b.method || p.method,
        reference: b.reference || p.reference,
        status: statusFor(amount, newPaid, p.dueDate),
      },
    });
    return { ok: true, paidAmount: newPaid, status: statusFor(amount, newPaid, p.dueDate) };
  });
}
