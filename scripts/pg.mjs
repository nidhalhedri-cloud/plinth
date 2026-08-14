// Local dev database: a real embedded Postgres (no system install). Keeps running in the
// background so Prisma + the app can connect at localhost:5433.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../.pgdata', import.meta.url));
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
});

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
try { await pg.createDatabase('developer_crm'); } catch { /* already exists */ }
console.log('PG_READY postgres://postgres:postgres@localhost:5433/developer_crm');

const stop = async () => { try { await pg.stop(); } catch {} process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
setInterval(() => {}, 1 << 30); // keep alive
