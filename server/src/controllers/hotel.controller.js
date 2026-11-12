import { hotelService } from '../services/hotel.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Controller handling Hotel HTTP endpoints
 * Purely responsible for HTTP input extraction and response mapping.
 * Contains no business logic or database queries.
 */
export class HotelController {
  /**
   * GET /api/v1/hotels
   * Lists hotels with optional city filtering and pagination
   */
  listHotels = asyncHandler(async (req, res) => {
    const { city, page, limit } = req.query;
    const result = await hotelService.getHotels({
      city,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result.hotels,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  });

  /**
   * GET /api/v1/hotels/:hotelId
   * Retrieves single hotel property by ID
   */
  getHotelById = asyncHandler(async (req, res) => {
    const { hotelId } = req.params;
    const hotel = await hotelService.getHotelById(hotelId);

    return sendSuccess(res, {
      statusCode: 200,
      data: hotel,
    });
  });

  /**
   * GET /api/v1/hotels/search
   * Searches hotels by destination and date interval
   */
  searchHotels = asyncHandler(async (req, res) => {
    const { destination, checkIn, checkOut, guests } = req.query;
    const results = await hotelService.searchHotels({
      destination,
      checkIn,
      checkOut,
      guests: guests ? Number(guests) : 1,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: results,
      meta: {
        count: results.length,
      },
    });
  });
}

export const hotelController = new HotelController();
export default hotelController;
