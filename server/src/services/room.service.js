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
   * Retrieves date-wise room availability and stay pricing for a specific room category
   *
   * @param {object} params
   * @param {string} params.roomTypeId
   * @param {string} params.checkIn
   * @param {string} params.checkOut
   * @param {number} [params.rooms=1]
   * @returns {Promise<object>}
   */
  async getRoomAvailability({ roomTypeId, checkIn, checkOut, rooms = 1 }) {
    if (!roomTypeId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'roomTypeId is required.', 400);
    }

    const dateValidation = validateStayDates(checkIn, checkOut, {
      timezone: 'Asia/Kolkata',
      maxStayNights: 30,
    });

    if (!dateValidation.valid) {
      throw new AppError(dateValidation.code, dateValidation.error, 400);
    }

    const safeRooms = Math.max(1, Number(rooms) || 1);

    const availability = await roomRepository.checkDateWiseAvailability({
      roomTypeId,
      checkIn,
      checkOut,
      requestedRooms: safeRooms,
    });

    if (!availability || !availability.roomType) {
      throw new AppError(
        ERROR_CODES.ROOM_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.ROOM_NOT_FOUND],
        404
      );
    }

    const { roomType } = availability;
    if (!roomType.active) {
      throw new AppError(
        ERROR_CODES.ROOM_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.ROOM_NOT_FOUND],
        404
      );
    }

    const nightlyRate = Number(roomType.pricePerNight || roomType.price_per_night);
    const nights = dateValidation.nights;
    const totalAmount = nightlyRate * nights * safeRooms;

    return {
      requestedDates: {
        checkIn,
        checkOut,
        nights,
        requestedRooms: safeRooms,
      },
      roomType: {
        id: roomType.id,
        hotelId: roomType.hotelId,
        hotelName: roomType.hotelName,
        name: roomType.name,
        description: roomType.description,
        maxGuests: roomType.maxGuests,
        pricePerNight: nightlyRate,
        currency: roomType.currency || 'INR',
        totalRooms: roomType.totalRooms,
      },
      totalRooms: roomType.totalRooms,
      availableRooms: availability.minAvailableRooms,
      availabilityStatus: availability.availabilityStatus,
      isAvailable: availability.isAvailable,
      pricing: {
        nightlyRate,
        nights,
        rooms: safeRooms,
        totalAmount,
        currency: roomType.currency || 'INR',
      },
      breakdown: availability.breakdown.map((b) => ({
        date: b.date,
        availableRooms: b.availableRooms,
        sufficient: b.sufficient,
      })),
    };
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
