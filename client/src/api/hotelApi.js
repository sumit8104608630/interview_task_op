import apiClient from './axiosClient';

/**
 * Hotel Catalogue, Search & Availability API Client
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
   * Searches active hotels that satisfy destination, date-wise room availability, capacity, price range, and amenities
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
   * @param {string} [params.amenities] - comma-separated codes or IDs
   * @param {'price'|'name'} [params.sortBy='price']
   * @param {'asc'|'desc'} [params.sortOrder='asc']
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ data: Array<object>, meta: object }>}
   */
  async searchHotels(params = {}) {
    return apiClient.get('/hotels/search', { params });
  },

  /**
   * Checks room availability across date range and retrieves authoritative stay quote
   * @param {object} params
   * @param {string} params.roomTypeId - Room Type UUID
   * @param {string} params.checkIn - YYYY-MM-DD
   * @param {string} params.checkOut - YYYY-MM-DD
   * @param {number} [params.rooms=1]
   * @returns {Promise<{ success: boolean, data: object }>}
   */
  async checkRoomAvailability(params = {}) {
    return apiClient.get('/rooms/availability', { params });
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
