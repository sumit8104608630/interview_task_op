import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { optionalAuth } from '../modules/auth/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/payments/config
 * @desc    Get public Razorpay configuration (Key ID, currency)
 * @access  Public
 */
router.get('/config', paymentController.getConfig);

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a Razorpay order for a pending reservation
 * @access  Public (supports optional authenticated session)
 */
router.post('/create-order', optionalAuth, paymentController.createOrder);

/**
 * @route   POST /api/payments/verify
 * @desc    Cryptographically verify Razorpay signature and confirm booking
 * @access  Public (supports optional authenticated session)
 */
router.post('/verify', optionalAuth, paymentController.verifyPayment);

/**
 * @route   POST /api/payments/webhook
 * @desc    Razorpay webhook endpoint
 * @access  Public (HMAC signature validated inside controller/service)
 */
router.post('/webhook', paymentController.handleWebhook);

/**
 * @route   GET /api/payments/booking/:reference
 * @desc    Get authoritative booking and payment details
 * @access  Public (supports optional authenticated session)
 */
router.get('/booking/:reference', optionalAuth, paymentController.getBookingPaymentDetails);

export default router;
