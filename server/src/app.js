import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware, requestLogger } from './middleware/requestLogger.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiRoutes from './routes/index.js';
import authRoutes from './modules/auth/auth.routes.js';
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

  // 3. CORS configuration with flexible local development origins and full header support
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin server-side tests)
        if (!origin) return callback(null, true);

        // In development / local testing, allow any localhost or 127.0.0.1 port (5173, 5174, 3000, etc.)
        const isLocalDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (isLocalDevelopment) {
          return callback(null, true);
        }

        const allowedOrigins = [
          env.FRONTEND_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ].filter(Boolean);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS policy violation: origin ${origin} is not allowed.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-request-id',
        'x-api-key',
        'x-csrf-token',
        'Idempotency-Key',
        'idempotency-key',
        'X-Idempotency-Key',
        'x-idempotency-key',
        'Accept',
        'X-Requested-With',
      ],
      exposedHeaders: ['set-cookie', 'x-request-id', 'x-csrf-token'],
    })
  );

  // 4. Request tracing & logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // 5. Body & Cookie parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. System Health-check endpoint
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

  // 7. Customer Authentication Module Routes
  // Mount both at /api/auth and /api/v1/auth for complete client compatibility
  app.use('/api/auth', authRoutes);
  app.use(`${env.API_PREFIX}/auth`, authRoutes);

  // 8. General Domain API Routes (/api and /api/v1 for complete compatibility)
  app.use('/api', apiRoutes);
  if (env.API_PREFIX && env.API_PREFIX !== '/api') {
    app.use(env.API_PREFIX, apiRoutes);
  }

  // 9. 404 Catch-All Handler
  app.use(notFound);

  // 10. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;
