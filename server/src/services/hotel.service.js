import { hotelRepository } from '../repositories/hotel.repository.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';
import { validateStayDates } from '../utils/dateUtils.js';

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
   * Searches active hotels that satisfy destination, date-wise room inventory availability, capacity, and price/amenity criteria
   *
   * @param {object} params
   * @param {string} [params.city]
   * @param {string} [params.destination]
   * @param {string} [params.locationId]
   * @param {string} params.checkIn - YYYY-MM-DD
   * @param {string} params.checkOut - YYYY-MM-DD
   * @param {number} [params.guests=1]
   * @param {number} [params.rooms=1]
   * @param {number} [params.minPrice]
   * @param {number} [params.maxPrice]
   * @param {Array<string>} [params.amenities]
   * @param {'price'|'lowest_price'|'highest_price'|'name'} [params.sortBy='price']
   * @param {'asc'|'desc'} [params.sortOrder='asc']
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ hotels: Array<object>, total: number, page: number, limit: number, totalPages: number, stay: object }>}
   */
  async searchHotels({
    city,
    destination,
    locationId,
    checkIn,
    checkOut,
    guests = 1,
    rooms = 1,
    minPrice,
    maxPrice,
    amenities,
    sortBy = 'price',
    sortOrder = 'asc',
    page = 1,
    limit = 10,
  } = {}) {
    const dateValidation = validateStayDates(checkIn, checkOut, {
      timezone: 'Asia/Kolkata',
      maxStayNights: 30,
    });

    if (!dateValidation.valid) {
      throw new AppError(dateValidation.code, dateValidation.error, 400);
    }

    const safeCity = (city || destination)?.trim() || null;
    const safeGuests = Math.max(1, Number(guests) || 1);
    const safeRooms = Math.max(1, Number(rooms) || 1);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));

    const result = await hotelRepository.searchAvailableHotels({
      city: safeCity,
      locationId: locationId?.trim() || null,
      checkIn,
      checkOut,
      guests: safeGuests,
      rooms: safeRooms,
      minPrice: minPrice !== undefined && minPrice !== null ? Number(minPrice) : null,
      maxPrice: maxPrice !== undefined && maxPrice !== null ? Number(maxPrice) : null,
      amenities,
      sortBy,
      sortOrder,
      page: safePage,
      limit: safeLimit,
    });

    const totalPages = Math.ceil(result.total / safeLimit) || 1;

    return {
      hotels: result.hotels,
      total: result.total,
      page: safePage,
      limit: safeLimit,
      totalPages,
      stay: {
        checkIn,
        checkOut,
        nights: dateValidation.nights,
        guests: safeGuests,
        rooms: safeRooms,
      },
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
