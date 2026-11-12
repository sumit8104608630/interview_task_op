import { Router } from 'express';
import { hotelController } from '../controllers/hotel.controller.js';
import { roomController } from '../controllers/room.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  getHotelsQuerySchema,
  hotelIdParamSchema,
} from '../validators/hotel.validator.js';

const router = Router();

/**
 * @route   GET /api/hotels
 * @desc    List active hotels with pagination, city/location filters, and sorting
 * @access  Public
 */
router.get('/', validate({ query: getHotelsQuerySchema }), hotelController.listHotels);

/**
 * @route   GET /api/hotels/:id
 * @desc    Get detailed hotel information by UUID or slug
 * @access  Public
 */
router.get('/:id', validate({ params: hotelIdParamSchema }), hotelController.getHotelById);

/**
 * @route   GET /api/hotels/:id/rooms
 * @desc    Get all active room types for a specific hotel
 * @access  Public
 */
router.get('/:id/rooms', validate({ params: hotelIdParamSchema }), roomController.getRoomsByHotel);

export default router;
