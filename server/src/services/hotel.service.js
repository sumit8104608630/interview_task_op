import { hotelRepository } from '../repositories/hotel.repository.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * Hotel Domain Business Service
 * Encapsulates catalog discovery, location filtering, sorting, pagination, and property details.
 */
export class HotelService {
  /**
   * Retrieves active hotels with filtering, sorting, and pagination
   *
   * @param {object} params
   * @param {string} [params.locationId]
   * @param {string} [params.city]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {'name'|'price'|'created_at'} [params.sortBy='name']
   * @param {'asc'|'desc'} [params.sortOrder='asc']
   * @returns {Promise<{ hotels: Array<object>, total: number, page: number, limit: number, totalPages: number }>}
   */
  async getHotels({
    locationId,
    city,
    page = 1,
    limit = 10,
    sortBy = 'name',
    sortOrder = 'asc',
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));

    const result = await hotelRepository.findAll({
      locationId: locationId?.trim() || null,
      city: city?.trim() || null,
      page: safePage,
      limit: safeLimit,
      sortBy: ['name', 'price', 'created_at'].includes(sortBy) ? sortBy : 'name',
      sortOrder: sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc',
    });

    const totalPages = Math.ceil(result.total / safeLimit) || 1;

    return {
      hotels: result.hotels,
      total: result.total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  /**
   * Retrieves complete details for a single active hotel by UUID or slug
   * Throws 404 if hotel is unknown or inactive.
   *
   * @param {string} hotelIdentifier - UUID or slug
   * @returns {Promise<object>}
   */
  async getHotelById(hotelIdentifier) {
    if (!hotelIdentifier) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Hotel identifier is required.', 400);
    }

    const hotel = await hotelRepository.findById(hotelIdentifier.trim());
    if (!hotel || !hotel.isActive) {
      throw new AppError(
        ERROR_CODES.HOTEL_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.HOTEL_NOT_FOUND],
        404
      );
    }

    return hotel;
  }
}

export const hotelService = new HotelService();
export default hotelService;
