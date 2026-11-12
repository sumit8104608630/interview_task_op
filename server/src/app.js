import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestIdMiddleware, requestLogger } from './middleware/requestLogger.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiRoutes from './routes/index.js';
import { checkDatabaseConnection } from './database/connection.js';

/**
 * Express application initialization and middleware configuration
 */
export const createApp = () => {
  const app = express();

  // 1. Trust proxy when running behind reverse proxies
  app.set('trust proxy', 1);

  // 2. Security headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 3. CORS configuration
  app.use(
    cors({
      origin: env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-api-key'],
    })
  );

  // 4. Request tracing & logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // 5. Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. Root & Health-check endpoints
  app.get('/api/health', async (req, res) => {
    const dbHealth = await checkDatabaseConnection();

    const healthStatus = {
      status: 'healthy',
      service: 'hotel-booking-portal-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      database: dbHealth,
    };

    return res.status(200).json(healthStatus);
  });

  // 7. API Routes registration under API_PREFIX (/api/v1)
  app.use(env.API_PREFIX, apiRoutes);

  // 8. 404 Catch-All Handler
  app.use(notFound);

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;
