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
   * GET /api/v1/room-types/:id/availability
   * Checks room availability across stay dates and calculates price quote
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
