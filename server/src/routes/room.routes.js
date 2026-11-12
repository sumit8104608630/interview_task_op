import { Router } from 'express';
import { roomController } from '../controllers/room.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  roomAvailabilityQuerySchema,
  roomParamSchema,
} from '../validators/room.validator.js';

const router = Router();

/**
 * @route   GET /api/rooms/availability
 * @desc    Check room availability across date range for a specified room category
 * @access  Public
 */
router.get(
  '/availability',
  validate({
    query: roomAvailabilityQuerySchema,
  }),
  roomController.getAvailability
);

/**
 * @route   GET /api/room-types/:id/availability or /api/rooms/:id/availability
 * @desc    Check room availability across date range and get price quote
 * @access  Public
 */
router.get(
  '/:id/availability',
  validate({
    params: roomParamSchema,
    query: roomAvailabilityQuerySchema,
  }),
  roomController.getAvailability
);

export default router;
