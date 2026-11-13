import apiClient from './axiosClient';

/**
 * Hotel Catalogue & Location API Client
 */
export const hotelApi = {
  /**
   * Fetches available hotel locations with active hotel counts
   * @param {object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @returns {Promise<{ data: Array<object>, meta: object }>}
   */
  async getLocations(params = {}) {
    return apiClient.get('/locations', { params });
  },

  /**
   * Fetches paginated list of active hotels with optional filters and sorting
   * @param {object} [params]
   * @param {string} [params.city]
   * @param {string} [params.locationId]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {'price'|'name'|'created_at'} [params.sortBy='name']
   * @param {'asc'|'desc'} [params.sortOrder='asc']
   * @returns {Promise<{ data: Array<object>, meta: object }>}
   */
  async getHotels(params = {}) {
    return apiClient.get('/hotels', { params });
  },

  /**
   * Fetches detailed information for a single hotel by UUID or slug
   * @param {string} id - Hotel UUID or slug
   * @returns {Promise<{ data: object }>}
   */
  async getHotelById(id) {
    return apiClient.get(`/hotels/${encodeURIComponent(id)}`);
  },

  /**
   * Fetches global reference list of amenities
   * @returns {Promise<{ data: Array<object> }>}
   */
  async getAmenities() {
    return apiClient.get('/amenities');
  },
};

export default hotelApi;
