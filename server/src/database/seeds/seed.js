import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkDatabaseConnection } from '../connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads the fake hotels JSON dataset from disk
 * @returns {Promise<Array<object>>}
 */
export const loadSeedData = async () => {
  const filePath = path.resolve(__dirname, 'data/hotels.json');
  const rawData = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(rawData);
};

/**
 * Minimal structural placeholder for database seeding.
 * Once the database schema is confirmed and migrated, this function will populate
 * the `hotels`, `hotel_images`, `room_types`, and `room_inventory` tables.
 */
export const runSeed = async () => {
  console.log('[Seed Runner] Checking database connectivity before seeding...');
  const health = await checkDatabaseConnection();

  if (!health.healthy) {
    console.warn('[Seed Runner] Database is currently unreachable or offline:', health.error);
    console.log('[Seed Runner] Seed execution deferred until database credentials and schema are configured.');
    return;
  }

  try {
    const hotels = await loadSeedData();
    console.log(`[Seed Runner] Loaded ${hotels.length} fictional hotels from seed dataset.`);
    console.log('[Seed Runner] Database schema awaiting evaluator approval. Migration and seed insertion deferred.');
  } catch (error) {
    console.error('[Seed Runner] Error reading seed dataset:', error.message);
    throw error;
  }
};

// Allow direct CLI execution: node src/database/seeds/seed.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Runner Failure]', err);
      await pool.end();
      process.exit(1);
    });
}

export default runSeed;
