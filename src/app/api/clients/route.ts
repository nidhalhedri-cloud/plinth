import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function GET() {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const db = tenantDb(admin.companyId!);
    const clients = await db.client.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { offers: true, documents: true } } } });
    return { clients: clients.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, idType: c.idType, idNumber: c.idNumber, deals: c._count.offers, docs: c._count.documents })) };
  });
}

const Create = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  idType: z.enum(['id', 'passport']).optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
});

export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);
    const b = Create.parse(await req.json());
    const c = await db.client.create({
      data: { companyId, name: b.name.trim(), email: b.email?.trim() || null, phone: b.phone?.trim() || null, idType: b.idType || null, idNumber: b.idNumber?.trim() || null, address: b.address?.trim() || null },
    });
    return { id: c.id };
  });
}
