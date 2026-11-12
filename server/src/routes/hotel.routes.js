import { Router } from 'express';
import { hotelController } from '../controllers/hotel.controller.js';
import { roomController } from '../controllers/room.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  getHotelsQuerySchema,
  searchHotelsQuerySchema,
  hotelIdParamSchema,
} from '../validators/hotel.validator.js';

const router = Router();

/**
 * @route   GET /api/v1/hotels/search
 * @desc    Search hotels by destination, check-in, check-out dates
 * @access  Public
 */
router.get('/search', validate({ query: searchHotelsQuerySchema }), hotelController.searchHotels);

/**
 * @route   GET /api/v1/hotels
 * @desc    List hotels with optional city filtering and pagination
 * @access  Public
 */
router.get('/', validate({ query: getHotelsQuerySchema }), hotelController.listHotels);

/**
 * @route   GET /api/v1/hotels/:hotelId
 * @desc    Get detailed hotel information by ID
 * @access  Public
 */
router.get('/:hotelId', validate({ params: hotelIdParamSchema }), hotelController.getHotelById);

/**
 * @route   GET /api/v1/hotels/:hotelId/rooms
 * @desc    Get all room types for a specific hotel
 * @access  Public
 */
router.get('/:hotelId/rooms', validate({ params: hotelIdParamSchema }), roomController.getRoomsByHotel);

export default router;
