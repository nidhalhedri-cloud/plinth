import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Client detail: their info, the units/deals they hold, and their document vault.
export function GET(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const c = await db.client.findFirst({
      where: { id: params.id },
      include: {
        offers: { orderBy: { createdAt: 'desc' }, include: { unit: { select: { unitNumber: true, project: { select: { name: true } } } } } },
        documents: { orderBy: { createdAt: 'desc' }, select: { id: true, label: true, mime: true, createdAt: true } },
      },
    });
    if (!c) throw new HttpError(404, 'Client not found');
    return {
      client: { id: c.id, name: c.name, email: c.email, phone: c.phone, idType: c.idType, idNumber: c.idNumber, address: c.address },
      deals: c.offers.map((o) => ({ id: o.id, unit: o.unit?.unitNumber, project: o.unit?.project?.name, status: o.status, price: Number(o.priceAed), booked: !!o.clientName })),
      documents: c.documents.map((d) => ({ id: d.id, label: d.label, mime: d.mime, createdAt: d.createdAt })),
    };
  });
}

const Patch = z.object({
  name: z.string().min(1).optional(), email: z.string().optional(), phone: z.string().optional(),
  idType: z.enum(['id', 'passport']).optional(), idNumber: z.string().optional(), address: z.string().optional(),
});
export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const b = Patch.parse(await req.json());
    await db.client.updateMany({ where: { id: params.id }, data: b });
    return { ok: true };
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    await db.client.deleteMany({ where: { id: params.id } });
    return { ok: true };
  });
}
