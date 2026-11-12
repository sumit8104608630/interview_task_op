import pg from 'pg';
import { dbConfig } from '../config/database.js';

const { Pool } = pg;

/**
 * Reusable PostgreSQL connection pool instance
 */
export const pool = new Pool(dbConfig);

// Handle idle client connection errors to prevent process termination
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error] Unexpected idle client error:', err.message);
});

/**
 * Executes a parameterized SQL query using a pool client
 * @param {string} text - SQL statement with $1, $2 placeholders
 * @param {Array<any>} [params] - Query parameter values
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('[SQL Execution]', { text, duration: `${duration}ms`, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('[SQL Execution Error]', { text, error: error.message });
    throw error;
  }
};

/**
 * Acquires a dedicated client for multi-statement transactions (BEGIN/COMMIT/ROLLBACK)
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Performs a lightweight health check to verify PostgreSQL connectivity
 * @returns {Promise<{ healthy: boolean, serverTime?: string, latencyMs?: number, error?: string }>}
 */
export const checkDatabaseConnection = async () => {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT NOW() AS server_time;');
    const latencyMs = Date.now() - start;
    return {
      healthy: true,
      serverTime: result.rows[0]?.server_time,
      latencyMs,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
    };
  }
};

export default {
  pool,
  query,
  getClient,
  checkDatabaseConnection,
};
