import { paymentService } from '../services/payment.service.js';
import { getPublicRazorpayConfig } from '../config/razorpay.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES } from '../constants/errorMessages.js';

/**
 * Controller handling Razorpay Payment Gateway HTTP endpoints
 */
export class PaymentController {
  /**
   * GET /api/payments/config
   * Returns public client Razorpay configuration (Key ID, currency)
   */
  getConfig = asyncHandler(async (req, res) => {
    const config = getPublicRazorpayConfig();
    return sendSuccess(res, {
      statusCode: 200,
      data: config,
      message: 'Razorpay public configuration retrieved successfully.',
    });
  });

  /**
   * POST /api/payments/create-order
   * Creates or retrieves a Razorpay order for an existing pending reservation
   */
  createOrder = asyncHandler(async (req, res) => {
    const { bookingReference, guestEmail } = req.body;
    const customerId = req.customer?.id || req.user?.id || null;

    if (!bookingReference) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference is required.', 400);
    }

    const orderData = await paymentService.createPaymentOrder({
      bookingReference: bookingReference.trim(),
      customerId,
      guestEmail: guestEmail ? guestEmail.trim() : null,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: orderData,
      message: 'Payment order created successfully.',
    });
  });

  /**
   * POST /api/payments/verify
   * Cryptographically verifies Razorpay HMAC signature and confirms booking
   */
  verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required for payment verification.',
        400
      );
    }

    const verificationResult = await paymentService.verifyPayment({
      razorpay_order_id: razorpay_order_id.trim(),
      razorpay_payment_id: razorpay_payment_id.trim(),
      razorpay_signature: razorpay_signature.trim(),
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: verificationResult,
      message: verificationResult.alreadyConfirmed
        ? 'Payment already verified and reservation confirmed.'
        : 'Payment verified successfully and reservation confirmed.',
    });
  });

  /**
   * POST /api/payments/webhook
   * Asynchronous webhook handler for server-to-server Razorpay event notifications
   */
  handleWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    await paymentService.handleWebhook({
      rawBody,
      signature,
      event: req.body,
    });

    return res.status(200).json({ status: 'ok' });
  });

  /**
   * GET /api/payments/booking/:reference
   * Returns authoritative booking and payment details for confirmation page
   */
  getBookingPaymentDetails = asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const details = await paymentService.getBookingPaymentDetails(reference);

    return sendSuccess(res, {
      statusCode: 200,
      data: details,
    });
  });
}

export const paymentController = new PaymentController();
export default paymentController;
