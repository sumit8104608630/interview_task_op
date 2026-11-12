import { hotelService } from '../services/hotel.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Controller handling Hotel HTTP Endpoints
 * Maps incoming HTTP query/path parameters to hotel service domain logic.
 */
export class HotelController {
  /**
   * GET /api/hotels
   * Lists active hotels with optional locationId, city filtering, pagination, and sorting
   */
  listHotels = asyncHandler(async (req, res) => {
    const { locationId, city, page, limit, sortBy, sortOrder } = req.query;

    const result = await hotelService.getHotels({
      locationId,
      city,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      sortBy,
      sortOrder,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result.hotels,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * GET /api/hotels/search
   * Searches active hotels that satisfy destination, date-wise room availability, capacity, price range, and amenities
   */
  searchHotels = asyncHandler(async (req, res) => {
    const {
      city,
      destination,
      locationId,
      checkIn,
      checkOut,
      guests,
      rooms,
      minPrice,
      maxPrice,
      amenities,
      sortBy,
      sortOrder,
      page,
      limit,
    } = req.query;

    const result = await hotelService.searchHotels({
      city,
      destination,
      locationId,
      checkIn,
      checkOut,
      guests: guests ? Number(guests) : 1,
      rooms: rooms ? Number(rooms) : 1,
      minPrice: minPrice !== undefined ? Number(minPrice) : null,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : null,
      amenities,
      sortBy,
      sortOrder,
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
        totalPages: result.totalPages,
        stay: result.stay,
      },
    });
  });

  /**
   * GET /api/hotels/:id
   * Retrieves single hotel property by UUID or slug with full details, images, amenities, and room types
   */
  getHotelById = asyncHandler(async (req, res) => {
    const id = req.params.id || req.params.hotelId;
    const hotel = await hotelService.getHotelById(id);

    return sendSuccess(res, {
      statusCode: 200,
      data: hotel,
    });
  });
}

export const hotelController = new HotelController();
export default hotelController;
