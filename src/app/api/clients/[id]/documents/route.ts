import { tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

// Attach a document to a client (passport, Emirates ID, signed SPA, cheque, …). Stored as an Asset
// and served through /api/assets/[id].
export function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const companyId = admin.companyId!;
    const db = tenantDb(companyId);
    const client = await db.client.findFirst({ where: { id: params.id }, select: { id: true } });
    if (!client) throw new HttpError(404, 'Client not found');

    const form = await req.formData();
    const label = String(form.get('label') || 'Document').trim() || 'Document';
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'No file uploaded');

    const asset = await db.asset.create({
      data: { companyId, kind: 'client_doc', clientId: params.id, label, mime: file.type || 'application/octet-stream', bytes: Buffer.from(await file.arrayBuffer()), size: file.size },
    });
    return { id: asset.id, label };
  });
}
