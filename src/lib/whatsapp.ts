import 'server-only';
import QRCode from 'qrcode';
import { prisma } from './db';

// Per-RM WhatsApp link via Baileys (WhatsApp Web multi-device). One socket per RM, since the number
// and its groups belong to that person. Auth state persists in whatsapp_sessions.authState so an RM
// doesn't re-scan after a restart. Anti-ban: a mandatory gap between sends + a daily cap, and every
// send is logged. Baileys is dynamically imported so it never bundles into the client.
//
// NOTE: this is the unofficial WhatsApp Web protocol — outside Meta's ToS — so heavy/automated use
// risks a number ban. It's deliberately behind this one module so it can later be swapped for the
// official Cloud API without touching the rest of the app.

// Minimal shape of the Baileys socket we actually use — avoids fighting its internal generics.
type WaSock = {
  ev: { on: (event: string, listener: (...args: unknown[]) => void) => void };
  user?: { id?: string };
  logout?: () => Promise<void>;
  groupFetchAllParticipating: () => Promise<Record<string, { id: string; subject: string }>>;
  sendMessage: (jid: string, content: unknown) => Promise<unknown>;
};
type WaUpdate = { connection?: string; qr?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } } };

type Session = { sock: WaSock; status: 'connecting' | 'connected' | 'disconnected'; qr: string | null; lastSendAt: number };
const sessions = new Map<string, Session>();
const connecting = new Map<string, Promise<void>>();

const SEND_GAP_MS = 4000; // minimum gap between two messages from the same number
const DAILY_CAP = 80; // per RM per rolling 24h

function toDataUrl(qr: string) { return QRCode.toDataURL(qr); }

async function loadAuth(rmUserId: string, companyId: string) {
  const baileys = await import('@whiskeysockets/baileys');
  const { initAuthCreds, BufferJSON } = baileys;
  const row = await prisma.whatsappSession.findUnique({ where: { rmUserId }, select: { authState: true } });
  const saved = (row?.authState as { creds?: string; keys?: string } | null) || null;
  const creds = saved?.creds ? JSON.parse(saved.creds, BufferJSON.reviver) : initAuthCreds();
  const keys: Record<string, Record<string, unknown>> = saved?.keys ? JSON.parse(saved.keys, BufferJSON.reviver) : {};

  const persist = async () => {
    await prisma.whatsappSession.upsert({
      where: { rmUserId },
      create: { rmUserId, companyId, status: 'connecting', authState: { creds: JSON.stringify(creds, BufferJSON.replacer), keys: JSON.stringify(keys, BufferJSON.replacer) } },
      update: { authState: { creds: JSON.stringify(creds, BufferJSON.replacer), keys: JSON.stringify(keys, BufferJSON.replacer) } },
    });
  };

  const keyStore = {
    get: (type: string, ids: string[]) => {
      const out: Record<string, unknown> = {};
      for (const id of ids) out[id] = keys[type]?.[id];
      return out;
    },
    set: (data: Record<string, Record<string, unknown>>) => {
      for (const type of Object.keys(data)) { keys[type] = keys[type] || {}; Object.assign(keys[type], data[type]); }
      void persist();
    },
  };

  return { state: { creds, keys: keyStore }, saveCreds: persist, baileys };
}

export async function connect(rmUserId: string, companyId: string): Promise<{ status: string; qr: string | null }> {
  const existing = sessions.get(rmUserId);
  if (existing?.status === 'connected') return { status: 'connected', qr: null };
  if (connecting.has(rmUserId)) { await connecting.get(rmUserId); const s = sessions.get(rmUserId); return { status: s?.status || 'connecting', qr: s?.qr || null }; }

  const run = (async () => {
    const { state, saveCreds, baileys } = await loadAuth(rmUserId, companyId);
    const makeWASocket = baileys.default as unknown as (config: unknown) => WaSock;
    const { DisconnectReason } = baileys;
    const sock = makeWASocket({ auth: state, printQRInTerminal: false, browser: ['Developer CRM', 'Chrome', '1.0'], syncFullHistory: false });
    sessions.set(rmUserId, { sock, status: 'connecting', qr: null, lastSendAt: 0 });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (...args: unknown[]) => {
      const u = args[0] as WaUpdate;
      const s = sessions.get(rmUserId); if (!s) return;
      if (u.qr) { s.qr = await toDataUrl(u.qr).catch(() => null); s.status = 'connecting'; }
      if (u.connection === 'open') {
        s.status = 'connected'; s.qr = null;
        const me = (sock as { user?: { id?: string } }).user?.id?.split(':')[0] || null;
        await prisma.whatsappSession.upsert({ where: { rmUserId }, create: { rmUserId, companyId, status: 'connected', phoneNumber: me }, update: { status: 'connected', phoneNumber: me } }).catch(() => {});
      }
      if (u.connection === 'close') {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        s.status = 'disconnected';
        await prisma.whatsappSession.updateMany({ where: { rmUserId }, data: { status: 'disconnected' } }).catch(() => {});
        sessions.delete(rmUserId);
        // Reconnect automatically unless the user logged out from their phone.
        if (code !== DisconnectReason.loggedOut) setTimeout(() => connect(rmUserId, companyId).catch(() => {}), 2000);
      }
    });
  })().finally(() => connecting.delete(rmUserId));

  connecting.set(rmUserId, run);
  await run;
  const s = sessions.get(rmUserId);
  return { status: s?.status || 'connecting', qr: s?.qr || null };
}

export function status(rmUserId: string): { status: string; qr: string | null } {
  const s = sessions.get(rmUserId);
  return { status: s?.status || 'disconnected', qr: s?.qr || null };
}

export async function disconnect(rmUserId: string) {
  const s = sessions.get(rmUserId);
  try { (s?.sock as { logout?: () => Promise<void> })?.logout?.(); } catch { /* ignore */ }
  sessions.delete(rmUserId);
  await prisma.whatsappSession.updateMany({ where: { rmUserId }, data: { status: 'disconnected', authState: undefined } }).catch(() => {});
}

export async function listGroups(rmUserId: string): Promise<{ id: string; subject: string }[]> {
  const s = sessions.get(rmUserId);
  if (!s || s.status !== 'connected') throw new Error('WhatsApp is not connected');
  const sock = s.sock as { groupFetchAllParticipating: () => Promise<Record<string, { id: string; subject: string }>> };
  const groups = await sock.groupFetchAllParticipating();
  return Object.values(groups).map((g) => ({ id: g.id, subject: g.subject })).sort((a, b) => a.subject.localeCompare(b.subject));
}

// Send a PDF into a group, honouring the gap + daily cap. Returns after logging.
export async function sendPdfToGroup(
  rmUserId: string, companyId: string, groupJid: string, pdf: Buffer, fileName: string, caption?: string,
  meta?: { brokerageId?: string; offerId?: string },
): Promise<void> {
  const s = sessions.get(rmUserId);
  if (!s || s.status !== 'connected') throw new Error('WhatsApp is not connected — link it first');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await prisma.whatsappSendLog.count({ where: { rmUserId, status: 'SENT', createdAt: { gte: since } } });
  if (sentToday >= DAILY_CAP) throw new Error(`Daily WhatsApp limit reached (${DAILY_CAP}). Try again tomorrow to keep your number safe.`);

  const wait = SEND_GAP_MS - (Date.now() - s.lastSendAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  try {
    const sock = s.sock as { sendMessage: (jid: string, content: unknown) => Promise<unknown> };
    await sock.sendMessage(groupJid, { document: pdf, mimetype: 'application/pdf', fileName, caption });
    s.lastSendAt = Date.now();
    await prisma.whatsappSendLog.create({ data: { companyId, rmUserId, brokerageId: meta?.brokerageId || null, offerId: meta?.offerId || null, groupJid, caption: caption || null, kind: 'PDF', status: 'SENT' } });
  } catch (e) {
    await prisma.whatsappSendLog.create({ data: { companyId, rmUserId, brokerageId: meta?.brokerageId || null, offerId: meta?.offerId || null, groupJid, caption: caption || null, kind: 'PDF', status: 'FAILED', error: (e as Error).message } });
    throw e;
  }
}
