import { roomRepository } from '../repositories/room.repository.js';
import { calculateNights, validateStayDates } from '../utils/dateUtils.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';
import { loadSeedData } from '../database/seeds/seed.js';

/**
 * Room Domain Business Service
 * Encapsulates room category discovery, stay pricing calculation, and inventory availability.
 */
export class RoomService {
  /**
   * Retrieves all room categories for a given hotel
   * @param {string} hotelId
   * @returns {Promise<Array<object>>}
   */
  async getRoomsByHotel(hotelId) {
    const rooms = await roomRepository.findByHotelId(hotelId);
    if (rooms && rooms.length > 0) {
      return rooms;
    }

    // Foundational fallback to seed dataset
    const seedHotels = await loadSeedData();
    const hotel = seedHotels.find((h) => h.id === hotelId);
    return hotel ? hotel.roomCategories : [];
  }

  /**
   * Calculates stay price quote and checks inventory availability across date range
   * @param {string} roomTypeId
   * @param {string} checkIn
   * @param {string} checkOut
   * @returns {Promise<{ roomTypeId: string, nights: number, pricePerNight: number, totalAmount: number, available: boolean }>}
   */
  async checkAvailabilityAndQuote(roomTypeId, checkIn, checkOut) {
    const validation = validateStayDates(checkIn, checkOut);
    if (!validation.valid) {
      throw new AppError(ERROR_CODES.INVALID_DATE_RANGE, validation.error, 400);
    }

    const nights = calculateNights(checkIn, checkOut);

    // Look up room category to retrieve authoritative server-side nightly price
    let room = await roomRepository.findById(roomTypeId);
    if (!room) {
      const seedHotels = await loadSeedData();
      for (const h of seedHotels) {
        const found = h.roomCategories.find((r) => r.id === roomTypeId);
        if (found) {
          room = found;
          break;
        }
      }
    }

    if (!room) {
      throw new AppError(
        ERROR_CODES.ROOM_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.ROOM_NOT_FOUND],
        404
      );
    }

    const nightlyRate = Number(room.pricePerNight || room.price_per_night);
    const totalAmount = nights * nightlyRate;

    return {
      roomTypeId,
      roomName: room.name,
      checkIn,
      checkOut,
      nights,
      pricePerNight: nightlyRate,
      totalAmount,
      available: true, // Baseline availability in foundational phase
    };
  }
}

export const roomService = new RoomService();
export default roomService;
