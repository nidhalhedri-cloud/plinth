import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCompanyUser, requireRole } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

export function GET() {
  return route(async () => {
    const u = await requireCompanyUser();
    const company = await prisma.company.findUnique({
      where: { id: u.companyId },
      select: { name: true, slug: true, logoUrl: true, brandColor: true, primaryContactName: true, primaryContactEmail: true, bookingTerms: true, spaTerms: true, smtpHost: true, smtpPort: true, smtpUser: true, fromEmail: true, fromName: true, remindersEnabled: true, reminderDaysBefore: true, defaultBrokerCommission: true, defaultRmCommission: true, brokerReleaseThreshold: true },
    });
    return { company };
  });
}

const Patch = z.object({
  name: z.string().min(1).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #2563eb').optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  bookingTerms: z.string().optional(),
  spaTerms: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional().nullable(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromEmail: z.string().optional(),
  fromName: z.string().optional(),
  remindersEnabled: z.boolean().optional(),
  reminderDaysBefore: z.number().int().min(0).max(60).optional(),
  defaultBrokerCommission: z.number().nonnegative().nullable().optional(),
  defaultRmCommission: z.number().nonnegative().nullable().optional(),
  brokerReleaseThreshold: z.number().min(0).max(100).optional(),
});

export function PATCH(req: Request) {
  return route(async () => {
    const admin = await requireRole('COMPANY_ADMIN');
    const body = Patch.parse(await req.json());
    await prisma.company.update({ where: { id: admin.companyId! }, data: body });
    return { ok: true };
  });
}
