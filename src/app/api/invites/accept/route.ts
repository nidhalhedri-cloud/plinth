import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, startSession, HttpError } from '@/lib/auth';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const Accept = z.object({
  token: z.string().min(10),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// RM accepts an invite: sets their name + password, becomes a user in the inviting company.
export function POST(req: Request) {
  return route(async () => {
    const body = Accept.parse(await req.json());

    const invite = await prisma.invite.findUnique({ where: { token: body.token } });
    if (!invite || invite.acceptedAt) throw new HttpError(400, 'This invite link is invalid or already used');
    if (invite.expiresAt < new Date()) throw new HttpError(400, 'This invite link has expired');
    if (await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          companyId: invite.companyId,
          email: invite.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName ?? null,
          role: invite.role,
          managerId: invite.managerId ?? null,
          brokerageId: invite.brokerageId ?? null,
        },
      });
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return u;
    });

    await startSession(user.id);
    return { id: user.id, email: user.email, role: user.role };
  });
}
