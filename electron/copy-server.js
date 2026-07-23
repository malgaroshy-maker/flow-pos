const { copyFileSync, mkdirSync, cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const srcServer = join(__dirname, '..', 'server', 'dist', 'server.js');
const destServer = join(__dirname, 'dist', 'server.js');

const srcDrizzle = join(__dirname, '..', 'server', 'drizzle');
const destDrizzle = join(__dirname, 'dist', 'drizzle');

mkdirSync(join(__dirname, 'dist'), { recursive: true });

if (existsSync(srcServer)) {
  copyFileSync(srcServer, destServer);
  console.log('✅ Copied server.js into electron/dist/server.js');
} else {
  console.error('⚠️ Warning: ../server/dist/server.js not found');
}

if (existsSync(srcDrizzle)) {
  cpSync(srcDrizzle, destDrizzle, { recursive: true });
  console.log('✅ Copied drizzle/ into electron/dist/drizzle');
} else {
  console.error('⚠️ Warning: ../server/drizzle not found');
}
