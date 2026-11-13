import { outboxRepository } from '../repositories/outbox.repository.js';
import { notificationClient } from '../integrations/notification/notification.client.js';
import { env } from '../config/env.js';

/**
 * Sanitizes error messages to prevent accidental leaking of credentials,
 * auth tokens, passwords, or OTP codes into logs or database records.
 *
 * @param {string|Error} err
 * @returns {string}
 */
export function sanitizeNotificationError(err) {
  if (!err) return 'Unknown notification delivery error';
  const raw = typeof err === 'string' ? err : err.message || String(err);

  return raw
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/x-api-key:\s*[^\s,]+/gi, 'x-api-key: [REDACTED]')
    .replace(/(password|secret|token|api_?key)\s*[:=]\s*["']?[^"',\s]+["']?/gi, '$1: [REDACTED]')
    .replace(/\b\d{6}\b/g, '[OTP_REDACTED]')
    .slice(0, 1000);
}

/**
 * Background Notification Outbox Worker
 *
 * Implements the Transactional Outbox Worker pattern:
 * - Polls due PENDING notification events
 * - Safely acquires rows with PostgreSQL FOR UPDATE SKIP LOCKED
 * - Leases events by advancing next_attempt_at to avoid concurrent re-processing
 * - Formats payloads and dispatches through the official microservice adapter
 * - Updates status to SENT upon success
 * - Applies exponential backoff on transient errors
 * - Transitions status to FAILED when configured max retry limit is exceeded
 * - Graceful start and stop with inflight drain
 */
export class NotificationWorker {
  /**
   * @param {object} [options]
   * @param {number} [options.pollIntervalMs]
   * @param {number} [options.batchSize]
   * @param {number} [options.maxAttempts]
   * @param {number} [options.initialBackoffMs]
   * @param {number} [options.backoffMultiplier]
   */
  constructor(options = {}) {
    this.options = {
      pollIntervalMs: options.pollIntervalMs || env.outboxWorker.pollIntervalMs,
      batchSize: options.batchSize || env.outboxWorker.batchSize,
      maxAttempts: options.maxAttempts || env.outboxWorker.maxAttempts,
      initialBackoffMs: options.initialBackoffMs || env.outboxWorker.initialBackoffMs,
      backoffMultiplier: options.backoffMultiplier || env.outboxWorker.backoffMultiplier,
    };

    this.isRunning = false;
    this.pollTimer = null;
    this.currentBatchPromise = null;
    this.isPolling = false;
  }

  /**
   * Starts periodic polling in the background
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Trigger initial poll asynchronously
    setImmediate(() => {
      this.pollCycle().catch((err) => {
        console.error('[NotificationWorker] Initial cycle error:', sanitizeNotificationError(err));
      });
    });

    this.pollTimer = setInterval(() => {
      this.pollCycle().catch((err) => {
        console.error('[NotificationWorker] Polling error:', sanitizeNotificationError(err));
      });
    }, this.options.pollIntervalMs);

    // Allow Node.js process to exit without waiting for timer
    if (this.pollTimer.unref) {
      this.pollTimer.unref();
    }
  }

  /**
   * Gracefully stops the worker and waits for any active batch to complete
   *
   * @returns {Promise<void>}
   */
  async stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.currentBatchPromise) {
      try {
        await this.currentBatchPromise;
      } catch (err) {
        // Drain quietly
      }
    }
  }

  /**
   * Single polling tick
   */
  async pollCycle() {
    if (!this.isRunning || this.isPolling) return;
    this.isPolling = true;

    try {
      this.currentBatchPromise = this.processDueEvents(this.options.batchSize);
      await this.currentBatchPromise;
    } catch (err) {
      // Non-fatal: PostgreSQL recovery or transient network glitches shouldn't crash worker
      console.warn('[NotificationWorker] Cycle encountered non-fatal error:', sanitizeNotificationError(err));
    } finally {
      this.currentBatchPromise = null;
      this.isPolling = false;
    }
  }

  /**
   * Claims and processes a batch of due outbox events.
   * Can be invoked directly in automated unit and integration tests.
   *
   * @param {number} [batchSize]
   * @returns {Promise<{ processed: number, succeeded: number, failed: number, events: Array<object> }>}
   */
  async processDueEvents(batchSize = this.options.batchSize) {
    const claimedEvents = await outboxRepository.claimDueEvents(batchSize);
    if (!claimedEvents || claimedEvents.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, events: [] };
    }

    let succeeded = 0;
    let failed = 0;
    const results = [];

    for (const event of claimedEvents) {
      const outcome = await this.processSingleEvent(event);
      results.push(outcome);
      if (outcome.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: claimedEvents.length,
      succeeded,
      failed,
      events: results,
    };
  }

  /**
   * Processes a single notification outbox event
   *
   * @param {object} event - Outbox record
   * @returns {Promise<{ success: boolean, eventId: string, error?: string, isFailed?: boolean }>}
   */
  async processSingleEvent(event) {
    const payload = event.payload || {};
    const recipientEmail = payload.guestEmail || payload.email;
    const guestName = payload.guestName || payload.name || 'Valued Guest';

    if (!recipientEmail) {
      const errorMsg = 'Missing recipient email in notification outbox payload';
      const attempts = (event.attempts || 0) + 1;
      await outboxRepository.recordFailure(event.id, {
        attempts,
        nextAttemptAt: new Date(Date.now() + 60000),
        isFailed: true,
        lastError: errorMsg,
      });
      return { success: false, eventId: event.id, error: errorMsg, isFailed: true };
    }

    try {
      let dispatchResult;

      switch (event.eventType) {
        case 'BOOKING_CONFIRMED':
        case 'BOOKING_CONFIRMATION':
          dispatchResult = await notificationClient.sendBookingConfirmation({
            email: recipientEmail,
            guestName,
            bookingDetails: payload,
          });
          break;

        case 'BOOKING_CANCELLED':
        case 'BOOKING_CANCELLATION':
          dispatchResult = await notificationClient.sendBookingCancellation({
            email: recipientEmail,
            guestName,
            bookingDetails: payload,
          });
          break;

        default:
          dispatchResult = await notificationClient.sendEmail({
            to: recipientEmail,
            subject: `Update regarding booking ${payload.bookingReference || ''}`,
            text: `Dear ${guestName}, your booking status has been updated.`,
          });
          break;
      }

      if (dispatchResult && dispatchResult.success === true) {
        // Successful delivery
        await outboxRepository.markSent(event.id);
        return {
          success: true,
          eventId: event.id,
          messageId: dispatchResult.messageId,
        };
      }

      // Microservice returned an error or non-success
      const rawError = dispatchResult?.error || 'External notification microservice rejected delivery';
      return await this.handleDeliveryFailure(event, rawError);
    } catch (err) {
      // Unhandled network exception or provider outage
      return await this.handleDeliveryFailure(event, err);
    }
  }

  /**
   * Handles delivery failure: calculates exponential backoff and sets status
   *
   * @param {object} event
   * @param {string|Error} error
   * @returns {Promise<{ success: boolean, eventId: string, error: string, isFailed: boolean }>}
   */
  async handleDeliveryFailure(event, error) {
    const safeError = sanitizeNotificationError(error);
    const attempts = (event.attempts || 0) + 1;
    const isFailed = attempts >= this.options.maxAttempts;

    const backoffMs = this.calculateBackoffMs(attempts);
    const nextAttemptAt = new Date(Date.now() + backoffMs);

    await outboxRepository.recordFailure(event.id, {
      attempts,
      nextAttemptAt,
      isFailed,
      lastError: safeError,
    });

    return {
      success: false,
      eventId: event.id,
      error: safeError,
      isFailed,
    };
  }

  /**
   * Calculates exponential backoff duration in milliseconds with jitter
   * Formula: initialBackoff * (multiplier ^ (attempt - 1)) + jitter
   *
   * @param {number} attempt
   * @returns {number}
   */
  calculateBackoffMs(attempt) {
    const base = this.options.initialBackoffMs;
    const mult = this.options.backoffMultiplier;
    const exponent = Math.max(0, attempt - 1);
    const exponential = base * Math.pow(mult, exponent);

    // Add up to 10% random jitter to avoid thundering herd
    const jitter = Math.floor(Math.random() * (base * 0.2));
    const maxBackoff = 3600000; // Cap at 1 hour

    return Math.min(Math.floor(exponential + jitter), maxBackoff);
  }
}

export const notificationWorker = new NotificationWorker();
export default notificationWorker;
