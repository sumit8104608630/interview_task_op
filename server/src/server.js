import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool, checkDatabaseConnection } from './database/connection.js';
import { notificationWorker } from './workers/notification.worker.js';

const server = http.createServer(app);

/**
 * Starts the HTTP server and logs runtime configuration
 */
const startServer = async () => {
  try {
    // Check database connection on startup (non-fatal warning if DB not yet online)
    const dbHealth = await checkDatabaseConnection();
    if (dbHealth.healthy) {
      console.log(`[Database] PostgreSQL connection established successfully (latency: ${dbHealth.latencyMs}ms).`);
    } else {
      console.warn(`[Database Warning] PostgreSQL is currently offline: ${dbHealth.error}`);
      console.warn('[Database Warning] Running in offline/fallback mode. Verify DB credentials in .env.');
    }

    server.listen(env.PORT, () => {
      console.log('====================================================');
      console.log(`🏨 Hotel Booking Portal Backend running successfully!`);
      console.log(`📍 Port:           ${env.PORT}`);
      console.log(`🌍 Environment:    ${env.NODE_ENV}`);
      console.log(`📡 Health Check:   http://localhost:${env.PORT}/api/health`);
      console.log(`🔗 API Base:       http://localhost:${env.PORT}${env.API_PREFIX}`);
      console.log('====================================================');

      if (env.outboxWorker.enabled && !env.isTest) {
        notificationWorker.start();
        console.log(`📨 Notification Outbox worker started (poll: ${env.outboxWorker.pollIntervalMs}ms).`);
      }
    });
  } catch (error) {
    console.error('[Server Initialization Error]', error);
    process.exit(1);
  }
};

/**
 * Handles graceful shutdown upon termination signals
 */
const handleGracefulShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await notificationWorker.stop();
      console.log('[Worker] Notification outbox worker stopped gracefully.');
      await pool.end();
      console.log('[Database] PostgreSQL pool drained and disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('[Database Error during shutdown]', err.message);
      process.exit(1);
    }
  });

  // Force shutdown after timeout if pending connections fail to close
  setTimeout(() => {
    console.error('[Server] Forced shutdown timeout reached. Exiting.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

startServer();

export { server };
export default server;
