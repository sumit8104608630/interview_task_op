import { locationRepository } from '../repositories/location.repository.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES } from '../constants/errorMessages.js';

/**
 * Location Business Logic Service
 * Exposes hotel locations and ensures inactive/empty regions are properly filtered.
 */
export class LocationService {
  /**
   * Retrieves available hotel locations
   * @param {object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @returns {Promise<{ locations: Array<object>, total: number, page: number, limit: number, totalPages: number }>}
   */
  async getLocations({ page = 1, limit = 50 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));

    const result = await locationRepository.findAll({
      page: safePage,
      limit: safeLimit,
    });

    const totalPages = Math.ceil(result.total / safeLimit) || 1;

    return {
      locations: result.locations,
      total: result.total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  /**
   * Retrieves single location details by ID or city name
   * @param {string} identifier - UUID or city string
   * @returns {Promise<object>}
   */
  async getLocationById(identifier) {
    if (!identifier) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Location identifier is required.', 400);
    }

    const location = await locationRepository.findById(identifier.trim());
    if (!location) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'The requested location was not found.', 404);
    }

    return location;
  }
}

export const locationService = new LocationService();
export default locationService;
