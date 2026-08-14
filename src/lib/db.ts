import { PrismaClient } from '@prisma/client';

// Base client. Use this ONLY for cross-tenant / pre-tenant system work: auth (look up a user by
// email at login), company signup, invite acceptance, platform-admin tooling. Everything else must
// go through tenantDb(companyId) so it is physically scoped to one tenant.
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma: PrismaClient = globalForPrisma.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

// Every tenant-scoped model carries a `companyId`. Any query through tenantDb() has that companyId
// forced into its `where` (reads/updates/deletes) and `data` (creates), so a bug in feature code
// can never leak or mutate another company's rows. The companyId always comes from the verified
// session — never from request input.
const TENANT_MODELS = new Set<string>([
  'User', 'Invite', 'Brokerage', 'BrokerageLink', 'Project', 'Layout', 'Unit',
  'PaymentPlan', 'PaymentMilestone', 'FeeSetting', 'Offer', 'WhatsappSession', 'WhatsappSendLog', 'Asset',
]);

const WHERE_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
]);

export type TenantClient = ReturnType<typeof buildTenantClient>;

function buildTenantClient(companyId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a: Record<string, unknown> = (args as Record<string, unknown>) ?? {};

          if (WHERE_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), companyId };
          }
          if (operation === 'create') {
            a.data = { ...((a.data as object) ?? {}), companyId };
          }
          if (operation === 'upsert') {
            a.create = { ...((a.create as object) ?? {}), companyId };
          }
          if (operation === 'createMany') {
            const d = a.data as unknown;
            a.data = Array.isArray(d) ? d.map((x) => ({ ...(x as object), companyId })) : { ...(d as object), companyId };
          }
          return query(a);
        },
      },
    },
  });
}

// Cache one extended client per company for the life of the process (extensions are cheap but the
// cache avoids rebuilding on every request).
const cache = new Map<string, TenantClient>();

export function tenantDb(companyId: string): TenantClient {
  if (!companyId) throw new Error('tenantDb requires a companyId');
  let c = cache.get(companyId);
  if (!c) { c = buildTenantClient(companyId); cache.set(companyId, c); }
  return c;
}
