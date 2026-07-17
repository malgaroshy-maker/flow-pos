import { buildApp } from './app.js';
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

const PORT = Number(process.env.POS_PORT ?? 3001);
const HOST = process.env.POS_HOST ?? '0.0.0.0'; // reachable from LAN devices

const sqlite = openDatabase();
runMigrations(sqlite);
seed(sqlite);

const app = buildApp(sqlite);

app.listen({ port: PORT, host: HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
