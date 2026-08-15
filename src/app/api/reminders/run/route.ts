import { prisma, tenantDb } from '@/lib/db';
import { requireRole, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';
import { runReminders } from '@/lib/reminders';

export const runtime = 'nodejs';

// Admin manually triggers payment reminders now. (The scheduler runs the same thing daily.)
export function POST() {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const company = await prisma.company.findUnique({ where: { id: admin.companyId! } });
    if (!company) throw new HttpError(404, 'Company not found');
    const result = await runReminders(tenantDb(company.id), company);
    return result;
  });
}
