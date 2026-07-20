import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
  const dbPath = path.resolve('./scratch-e2e.db');

  // Clean previous scratch DB files so server boot initializes clean DB
  for (const ext of ['', '-wal', '-shm']) {
    const file = `${dbPath}${ext}`;
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch (err) {
        // ignore if locked by running server
      }
    }
  }
}
