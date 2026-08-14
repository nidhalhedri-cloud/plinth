import { prisma, tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Upload the company logo → stored as an Asset, referenced from company.logoUrl. It's inlined into
// every generated offer PDF's header.
export function POST(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'No image uploaded');

    const asset = await tenantDb(companyId).asset.create({
      data: { companyId, kind: 'logo', mime: file.type || 'image/png', bytes: Buffer.from(await file.arrayBuffer()), size: file.size },
    });
    await prisma.company.update({ where: { id: companyId }, data: { logoUrl: `/api/assets/${asset.id}` } });
    return { logoUrl: `/api/assets/${asset.id}` };
  });
}
