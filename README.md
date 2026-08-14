# Developer CRM

Multi-tenant SaaS for **Dubai real-estate developers** — manage brokerages, unit inventory,
payment plans, fees, and generate branded sales offers sent straight to a broker's WhatsApp group.
Intended to run at **dev.custrox.com**.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma 6
- JWT cookie auth (jose) + bcrypt, role-based access
- Puppeteer (offer PDFs), SheetJS (Excel), Baileys (WhatsApp) — added in their phases

## Multi-tenant isolation (the important part)
Every tenant-scoped table carries `companyId`. `src/lib/db.ts` exposes:
- `prisma` — base client, used **only** for auth / signup / invite-accept / platform work.
- `tenantDb(companyId)` — a Prisma extension that **forces** `companyId` into every query's `where`
  (reads/updates/deletes) and `data` (creates). Feature code always uses this, so a bug can't leak
  or mutate another company's rows. The `companyId` always comes from the verified session.

## Getting it running (needs a Postgres)
1. Provision Postgres (Neon / Supabase / Railway) and set `DATABASE_URL` in `.env`
   (copy `.env.example`), plus a real `JWT_SECRET` (`openssl rand -base64 48`).
2. Create the schema:
   ```bash
   npx prisma migrate dev --name init
   ```
3. Run it:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000 → **Create your workspace** (becomes Company Admin) → invite RMs from **Team**.

## Build phases
1. ✅ Multi-tenant foundation — auth, RBAC, tenant isolation, company onboarding, RM invites.
2. ⬜ Inventory core — Excel template + upload/validation, unit list/search/status.
3. ⬜ Layouts — floor-plan image per typology, auto-matched to units.
4. ⬜ Payment plans + fees — template builder with Dubai presets, editable fee defaults.
5. ⬜ Sales-offer generator — Puppeteer PDF, edit-before-send, open-tracked web link.
6. ⬜ Brokerages + WhatsApp (Baileys) — QR connect, group linking, send-to-group, anti-ban logging.
7. ⬜ Pipeline + dashboards — deal status tracking, reporting.
8. ⬜ Polish — branding, notifications, audit log, admin tooling.
