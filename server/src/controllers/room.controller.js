import { roomService } from '../services/room.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Controller handling Room and Availability HTTP endpoints
 */
export class RoomController {
  /**
   * GET /api/v1/hotels/:hotelId/rooms
   * Retrieves all room categories for a hotel
   */
  getRoomsByHotel = asyncHandler(async (req, res) => {
    const hotelId = req.params.id || req.params.hotelId;
    const rooms = await roomService.getRoomsByHotel(hotelId);

    return sendSuccess(res, {
      statusCode: 200,
      data: rooms,
    });
  });

  /**
   * GET /api/rooms/availability and GET /api/room-types/:id/availability
   * Checks room availability across stay dates and returns structured stay, capacity, and pricing breakdown
   */
  getAvailability = asyncHandler(async (req, res) => {
    const roomTypeId = req.query.roomTypeId || req.params.id || req.params.roomTypeId;
    const { checkIn, checkOut, rooms } = req.query;

    const result = await roomService.getRoomAvailability({
      roomTypeId,
      checkIn,
      checkOut,
      rooms: rooms ? Number(rooms) : 1,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
    });
  });

  /**
   * GET /api/v1/room-types/:id/availability
   * Checks room availability across stay dates and calculates price quote (backward compatible)
   */
  checkAvailability = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut } = req.query;

    const quote = await roomService.checkAvailabilityAndQuote(id, checkIn, checkOut);

    return sendSuccess(res, {
      statusCode: 200,
      data: quote,
    });
  });
}

export const roomController = new RoomController();
export default roomController;
