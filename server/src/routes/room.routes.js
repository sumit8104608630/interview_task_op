import { Router } from 'express';
import { roomController } from '../controllers/room.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  roomAvailabilityQuerySchema,
  roomParamSchema,
} from '../validators/room.validator.js';

const router = Router();

/**
 * @route   GET /api/v1/room-types/:id/availability
 * @desc    Check room availability across date range and get price quote
 * @access  Public
 */
router.get(
  '/:id/availability',
  validate({
    params: roomParamSchema,
    query: roomAvailabilityQuerySchema,
  }),
  roomController.checkAvailability
);

export default router;
