import { amenityRepository } from '../repositories/amenity.repository.js';

/**
 * Amenity Business Logic Service
 */
export class AmenityService {
  /**
   * Retrieves all available amenities
   * @returns {Promise<Array<object>>}
   */
  async getAmenities() {
    const amenities = await amenityRepository.findAll();
    return amenities;
  }
}

export const amenityService = new AmenityService();
export default amenityService;
