import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, startSession, HttpError } from '@/lib/auth';
import { route, slugify, token } from '@/lib/http';
import { seedFeeDefaults } from '@/lib/seed';

export const runtime = 'nodejs';

const Signup = z.object({
  companyName: z.string().min(2, 'Company name is too short'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function POST(req: Request) {
  return route(async () => {
    const body = Signup.parse(await req.json());
    const email = body.email.toLowerCase();

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    let slug = slugify(body.companyName);
    if (await prisma.company.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${token(3)}`;

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: body.companyName,
          slug,
          primaryContactName: `${body.firstName} ${body.lastName || ''}`.trim(),
          primaryContactEmail: email,
        },
      });
      await seedFeeDefaults(tx, company.id);
      return tx.user.create({
        data: {
          companyId: company.id,
          email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName ?? null,
          role: 'COMPANY_ADMIN',
        },
      });
    });

    await startSession(user.id);
    return { id: user.id, email: user.email, role: user.role };
  });
}
