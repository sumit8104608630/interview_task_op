import { env } from './env.js';

/**
 * PostgreSQL connection pool configuration options
 */
export const dbConfig = env.db.connectionString
  ? {
      connectionString: env.db.connectionString,
      ssl: env.isProduction ? { rejectUnauthorized: false } : false,
      max: env.db.max,
      idleTimeoutMillis: env.db.idleTimeoutMillis,
      connectionTimeoutMillis: env.db.connectionTimeoutMillis,
    }
  : {
      host: env.db.host,
      port: env.db.port,
      database: env.db.database,
      user: env.db.user,
      password: env.db.password,
      ssl: env.isProduction ? { rejectUnauthorized: false } : false,
      max: env.db.max,
      idleTimeoutMillis: env.db.idleTimeoutMillis,
      connectionTimeoutMillis: env.db.connectionTimeoutMillis,
    };

export default dbConfig;
