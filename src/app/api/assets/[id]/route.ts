import { currentUser } from '@/lib/auth';
import { tenantDb } from '@/lib/db';

export const runtime = 'nodejs';

// Serve a stored binary (layout image / logo) to signed-in users of the owning company.
// Public offer pages fetch layout images through the offer's own token route (Phase 5), not here.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await currentUser();
  if (!u?.companyId) return new Response('Unauthorized', { status: 401 });
  const db = tenantDb(u.companyId);
  const asset = await db.asset.findFirst({ where: { id: params.id }, select: { mime: true, bytes: true } });
  if (!asset) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: { 'Content-Type': asset.mime, 'Cache-Control': 'private, max-age=3600' },
  });
}
