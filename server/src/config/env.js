import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the server root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Application environment configuration object
 * Centralizes all process.env accesses with sensible development defaults.
 */
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  // Database settings
  db: {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'hotel_booking_portal',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '5000', 10),
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'hotel-booking-portal-secure-jwt-secret-min-32-chars-key',
    issuer: process.env.JWT_ISSUER || 'hotel-booking-portal',
    audience: process.env.JWT_AUDIENCE || 'hotel-booking-portal-customer',
    sessionTtl: process.env.CUSTOMER_SESSION_TTL || '7d',
    algorithm: 'HS256',
  },

  // Cookie Configuration
  cookies: {
    authCookieName: process.env.AUTH_COOKIE_NAME || 'auth_token',
    csrfCookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
  },

  // External OTP & Notification Microservice
  otpService: {
    baseUrl: process.env.OTP_SERVICE_BASE_URL || process.env.NOTIFICATION_SERVICE_BASE_URL || 'https://otp-microservise.vercel.app',
    apiKey: process.env.OTP_SERVICE_API_KEY || process.env.NOTIFICATION_SERVICE_API_KEY || '',
    timeoutMs: parseInt(process.env.OTP_SERVICE_TIMEOUT_MS || '10000', 10),
  },

  // Legacy notification service reference for backward compatibility
  notificationService: {
    baseUrl: process.env.NOTIFICATION_SERVICE_BASE_URL || 'https://otp-microservise.vercel.app',
    apiKey: process.env.NOTIFICATION_SERVICE_API_KEY || '',
    timeoutMs: parseInt(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS || '10000', 10),
  },

  // Notification Outbox Worker settings
  outboxWorker: {
    pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '3000', 10),
    batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '10', 10),
    maxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS || '5', 10),
    initialBackoffMs: parseInt(process.env.OUTBOX_INITIAL_BACKOFF_MS || '5000', 10),
    backoffMultiplier: parseFloat(process.env.OUTBOX_BACKOFF_MULTIPLIER || '2.0'),
    enabled: process.env.OUTBOX_WORKER_ENABLED !== 'false',
  },

  // Cloudinary settings
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Razorpay Payment Gateway (Test Mode / Production)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    currency: process.env.RAZORPAY_CURRENCY || 'INR',
    orderExpiryMinutes: parseInt(process.env.RESERVATION_EXPIRY_MINUTES || '15', 10),
  },

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  isTest: process.env.NODE_ENV === 'test',
};

// Validate critical configurations in production
if (env.isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters long in production mode.');
  }
}

export default env;
