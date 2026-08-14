import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function GET() {
  return route(async () => {
    const u = await currentUser();
    if (!u) return { user: null };
    const company = u.companyId
      ? await prisma.company.findUnique({
          where: { id: u.companyId },
          select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true },
        })
      : null;
    return { user: u, company };
  });
}
