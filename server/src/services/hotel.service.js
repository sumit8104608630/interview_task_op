import { hotelRepository } from '../repositories/hotel.repository.js';
import { loadSeedData } from '../database/seeds/seed.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * Hotel Domain Business Service
 * Encapsulates catalog discovery, location filtering, and property details.
 */
export class HotelService {
  /**
   * Retrieves hotels with optional city filtering and pagination
   * @param {object} params
   * @param {string} [params.city]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ hotels: Array<object>, total: number, page: number, limit: number }>}
   */
  async getHotels({ city, page = 1, limit = 10 } = {}) {
    try {
      // Primary: Attempt repository retrieval
      const repoResult = await hotelRepository.findAll({
        city,
        limit,
        offset: (page - 1) * limit,
      });

      if (repoResult && repoResult.hotels.length > 0) {
        return {
          ...repoResult,
          page,
          limit,
        };
      }

      // Foundational fallback: Serve from local seed dataset if database has not yet been seeded
      const fallbackData = await loadSeedData();
      let filtered = fallbackData;
      if (city) {
        filtered = filtered.filter((h) =>
          h.location.city.toLowerCase().includes(city.toLowerCase())
        );
      }

      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return {
        hotels: paginated,
        total: filtered.length,
        page,
        limit,
      };
    } catch (error) {
      console.warn('[HotelService.getHotels] Database unavailable, reading from seed dataset:', error.message);
      const fallbackData = await loadSeedData();
      return {
        hotels: fallbackData.slice(0, limit),
        total: fallbackData.length,
        page,
        limit,
      };
    }
  }

  /**
   * Retrieves complete details for a single hotel by ID
   * @param {string} hotelId
   * @returns {Promise<object>}
   */
  async getHotelById(hotelId) {
    const hotel = await hotelRepository.findById(hotelId);
    if (hotel) {
      return hotel;
    }

    // Fallback to seed dataset during initialization phase
    const seedHotels = await loadSeedData();
    const found = seedHotels.find((h) => h.id === hotelId);
    if (!found) {
      throw new AppError(
        ERROR_CODES.HOTEL_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.HOTEL_NOT_FOUND],
        404
      );
    }

    return found;
  }

  /**
   * Searches hotels for a given destination and stay interval
   * @param {object} params
   * @param {string} params.destination
   * @param {string} params.checkIn
   * @param {string} params.checkOut
   * @param {number} [params.guests=1]
   * @returns {Promise<Array<object>>}
   */
  async searchHotels({ destination, checkIn, checkOut, guests = 1 }) {
    // In full implementation, verifies date availability against room_inventory
    const allHotels = await loadSeedData();
    const queryTerm = destination.toLowerCase();

    return allHotels.filter(
      (h) =>
        h.location.city.toLowerCase().includes(queryTerm) ||
        h.location.state.toLowerCase().includes(queryTerm) ||
        h.name.toLowerCase().includes(queryTerm)
    );
  }
}

export const hotelService = new HotelService();
export default hotelService;
