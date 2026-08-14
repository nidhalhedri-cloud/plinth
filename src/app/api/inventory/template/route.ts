import { currentUser } from '@/lib/auth';
import { buildTemplate } from '@/lib/excel';

export const runtime = 'nodejs';

export async function GET() {
  const u = await currentUser();
  if (!u) return new Response('Unauthorized', { status: 401 });
  const buf = buildTemplate();
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="inventory-template.xlsx"',
    },
  });
}
