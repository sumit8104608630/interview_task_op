import { paymentService } from '../services/payment.service.js';

/**
 * Background Booking Expiry Worker
 *
 * Periodically scans for reservations in PENDING_PAYMENT status
 * whose holding window (expires_at) has passed.
 * Automatically releases reserved room inventory back to room_inventory
 * and marks bookings as PAYMENT_EXPIRED.
 */
export class BookingExpiryWorker {
  /**
   * @param {object} [options]
   * @param {number} [options.intervalMs=30000] - Scan interval (defaults to 30s)
   */
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 30000;
    this.isRunning = false;
    this.timer = null;
    this.isProcessing = false;
  }

  /**
   * Starts the background expiry scheduler
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run first check after a brief initial delay
    this.timer = setTimeout(() => this._runLoop(), 5000);
  }

  /**
   * Stops the worker gracefully
   */
  async stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Single polling execution
   */
  async _runLoop() {
    if (!this.isRunning) return;

    if (!this.isProcessing) {
      this.isProcessing = true;
      try {
        const expiredReferences = await paymentService.expirePendingReservations();
        if (expiredReferences && expiredReferences.length > 0) {
          console.log(
            `[BookingExpiryWorker] Expired ${expiredReferences.length} stale pending reservation(s) and restored inventory: ${expiredReferences.join(', ')}`
          );
        }
      } catch (err) {
        console.error('[BookingExpiryWorker] Error running pending reservation expiry loop:', err.message);
      } finally {
        this.isProcessing = false;
      }
    }

    if (this.isRunning) {
      this.timer = setTimeout(() => this._runLoop(), this.intervalMs);
    }
  }
}

export const bookingExpiryWorker = new BookingExpiryWorker();
export default bookingExpiryWorker;
