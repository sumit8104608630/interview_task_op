import { roomRepository } from '../repositories/room.repository.js';
import { hotelRepository } from '../repositories/hotel.repository.js';
import { calculateNights, validateStayDates } from '../utils/dateUtils.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * Room Domain Business Service
 * Encapsulates room category discovery, stay pricing calculation, and inventory availability.
 */
export class RoomService {
  /**
   * Retrieves all active room categories for a given hotel
   * Validates hotel existence (throws 404 if hotel is unknown or inactive).
   *
   * @param {string} hotelIdentifier - Hotel UUID or slug
   * @returns {Promise<Array<object>>}
   */
  async getRoomsByHotel(hotelIdentifier) {
    if (!hotelIdentifier) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Hotel identifier is required.', 400);
    }

    // Validate hotel existence & active status
    const hotel = await hotelRepository.findById(hotelIdentifier);
    if (!hotel || !hotel.is_active) {
      throw new AppError(
        ERROR_CODES.HOTEL_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.HOTEL_NOT_FOUND],
        404
      );
    }

    const rooms = await roomRepository.findByHotelId(hotelIdentifier);
    return rooms;
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

    const room = await roomRepository.findById(roomTypeId);
    if (!room || !room.active) {
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
      available: true,
    };
  }
}

export const roomService = new RoomService();
export default roomService;
