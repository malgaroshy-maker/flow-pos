import { buildApp } from './app.js';
import { openDatabase, createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';
import { runDailyBackupIfNeeded } from './lib/autoBackup.js';
import { loadPersistedSessions } from './routes/auth.js';

const PORT = Number(process.env.POS_PORT ?? 3001);
const HOST = process.env.POS_HOST ?? '0.0.0.0'; // reachable from LAN devices

const sqlite = openDatabase();
runMigrations(sqlite);
seed(sqlite);

// Rehydrate logged-in cashier sessions from disk so a desktop-app restart
// mid-shift doesn't force every device to log back in.
loadPersistedSessions(createDb(sqlite));

const app = buildApp(sqlite);

app.listen({ port: PORT, host: HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// PRD NFR: "automatic daily local backup". Runs once at boot and then hourly
// (cheap no-op once today's backup exists) so a day rollover is caught even
// if the shop PC sleeps and the process itself is never restarted.
const checkDailyBackup = () =>
  runDailyBackupIfNeeded(app.sqlite, app.db).catch((err) =>
    app.log.error(err, 'Automatic daily backup failed')
  );
checkDailyBackup();
setInterval(checkDailyBackup, 60 * 60 * 1000);
