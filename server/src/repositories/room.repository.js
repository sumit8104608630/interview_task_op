import { query, checkDatabaseConnection } from '../database/connection.js';
import { loadCatalogueData } from '../database/seeds/seed.js';
import { getStayDates, calculateNights } from '../utils/dateUtils.js';

/**
 * Room and Inventory Data Access Repository
 * Encapsulates PostgreSQL queries for room categories, pricing, and nightly inventory.
 * Supports date-wise inventory checks, transactional row locking, and deterministic in-memory state for testing.
 */
export class RoomRepository {
  constructor() {
    this.forceInMemory = false;
    this.inMemoryInventory = new Map();
  }

  setForceInMemory(flag) {
    this.forceInMemory = flag;
    if (!flag) {
      this.inMemoryInventory.clear();
    }
  }

  /**
   * For testing: set specific available rooms for a room type and date
   * @param {string} roomTypeId
   * @param {string} dateStr - YYYY-MM-DD
   * @param {number} availableRooms
   */
  setInventory(roomTypeId, dateStr, availableRooms) {
    this.inMemoryInventory.set(`${roomTypeId}_${dateStr}`, availableRooms);
  }

  /**
   * For testing: remove an inventory date record (simulates missing inventory)
   * @param {string} roomTypeId
   * @param {string} dateStr - YYYY-MM-DD
   */
  deleteInventory(roomTypeId, dateStr) {
    this.inMemoryInventory.set(`${roomTypeId}_${dateStr}`, null);
  }

  /**
   * Clears custom test inventory overrides
   */
  resetInventory() {
    this.inMemoryInventory.clear();
  }

  async _usePostgres() {
    if (this.forceInMemory) return false;
    const health = await checkDatabaseConnection();
    return health.healthy;
  }

  /**
   * Retrieves active room categories for a given hotel (by UUID or slug)
   * @param {string} hotelIdentifier - Hotel UUID or slug
   * @returns {Promise<Array<object>>}
   */
  async findByHotelId(hotelIdentifier) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          rt.id,
          rt.hotel_id AS "hotelId",
          rt.name,
          rt.description,
          rt.max_guests AS "maxGuests",
          rt.price_per_night AS "pricePerNight",
          rt.currency,
          rt.total_rooms AS "totalRooms",
          rt.active
        FROM room_types rt
        JOIN hotels h ON h.id = rt.hotel_id
        WHERE (h.id::text = $1 OR h.slug = $1)
          AND h.is_active = TRUE
          AND rt.active = TRUE
        ORDER BY rt.price_per_night ASC;
      `;
      const result = await query(sql, [hotelIdentifier]);
      return result.rows.map((r) => ({
        ...r,
        pricePerNight: Number(r.pricePerNight),
      }));
    }

    // In-memory fallback
    const catalogue = await loadCatalogueData();
    const hotel = catalogue.hotels.find(
      (h) => (h.id === hotelIdentifier || h.slug === hotelIdentifier) && h.is_active
    );
    if (!hotel) return [];

    const rooms = catalogue.roomTypes
      .filter((r) => r.hotel_id === hotel.id && r.active)
      .map((r) => ({
        id: r.id,
        hotelId: r.hotel_id,
        name: r.name,
        description: r.description,
        maxGuests: r.max_guests,
        pricePerNight: Number(r.price_per_night),
        currency: r.currency || 'INR',
        totalRooms: r.total_rooms,
        active: r.active,
      }))
      .sort((a, b) => a.pricePerNight - b.pricePerNight);

    return rooms;
  }

  /**
   * Finds a room category by ID with its authoritative nightly rate
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          rt.id,
          rt.hotel_id AS "hotelId",
          h.name AS "hotelName",
          h.is_active AS "hotelIsActive",
          rt.name,
          rt.description,
          rt.max_guests AS "maxGuests",
          rt.price_per_night AS "pricePerNight",
          rt.currency,
          rt.total_rooms AS "totalRooms",
          rt.active
        FROM room_types rt
        JOIN hotels h ON h.id = rt.hotel_id
        WHERE rt.id = $1
        LIMIT 1;
      `;
      const result = await query(sql, [id]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        ...row,
        pricePerNight: Number(row.pricePerNight),
      };
    }

    const catalogue = await loadCatalogueData();
    const r = catalogue.roomTypes.find((item) => item.id === id);
    if (!r) return null;

    const hotel = catalogue.hotels.find((h) => h.id === r.hotel_id);

    return {
      id: r.id,
      hotelId: r.hotel_id,
      hotelName: hotel?.name || 'Hotel',
      hotelIsActive: hotel ? hotel.is_active : true,
      name: r.name,
      description: r.description,
      maxGuests: r.max_guests,
      pricePerNight: Number(r.price_per_night),
      currency: r.currency || 'INR',
      totalRooms: r.total_rooms,
      active: r.active,
    };
  }

  /**
   * Checks date-wise room inventory across requested stay interval [checkIn, checkOut)
   *
   * @param {object} params
   * @param {string} params.roomTypeId
   * @param {string} params.checkIn - YYYY-MM-DD
   * @param {string} params.checkOut - YYYY-MM-DD
   * @param {number} [params.requestedRooms=1]
   * @returns {Promise<{
   *   roomType: object,
   *   checkIn: string,
   *   checkOut: string,
   *   nights: number,
   *   requestedRooms: number,
   *   minAvailableRooms: number,
   *   isAvailable: boolean,
   *   availabilityStatus: 'AVAILABLE'|'INSUFFICIENT_ROOMS'|'MISSING_INVENTORY',
   *   breakdown: Array<{ date: string, availableRooms: number, sufficient: boolean, hasInventory: boolean }>
   * }>}
   */
  async checkDateWiseAvailability({ roomTypeId, checkIn, checkOut, requestedRooms = 1 }) {
    const room = await this.findById(roomTypeId);
    if (!room) return null;

    const stayDates = getStayDates(checkIn, checkOut);
    const nights = stayDates.length;

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          TO_CHAR(ri.inventory_date, 'YYYY-MM-DD') AS inventory_date,
          ri.available_rooms
        FROM room_inventory ri
        WHERE ri.room_type_id = $1
          AND ri.inventory_date >= $2::date
          AND ri.inventory_date < $3::date
        ORDER BY ri.inventory_date ASC;
      `;
      const result = await query(sql, [roomTypeId, checkIn, checkOut]);
      const dateMap = new Map(result.rows.map((row) => [row.inventory_date, row.available_rooms]));

      let minAvailableRooms = Infinity;
      let hasMissingInventory = false;
      let hasInsufficientRooms = false;
      const breakdown = [];

      for (const date of stayDates) {
        if (!dateMap.has(date)) {
          hasMissingInventory = true;
          minAvailableRooms = 0;
          breakdown.push({
            date,
            availableRooms: 0,
            hasInventory: false,
            sufficient: false,
          });
        } else {
          const avail = dateMap.get(date);
          minAvailableRooms = Math.min(minAvailableRooms, avail);
          const sufficient = avail >= requestedRooms;
          if (!sufficient) hasInsufficientRooms = true;

          breakdown.push({
            date,
            availableRooms: avail,
            hasInventory: true,
            sufficient,
          });
        }
      }

      if (minAvailableRooms === Infinity) minAvailableRooms = 0;

      let availabilityStatus = 'AVAILABLE';
      if (hasMissingInventory) {
        availabilityStatus = 'MISSING_INVENTORY';
      } else if (hasInsufficientRooms) {
        availabilityStatus = 'INSUFFICIENT_ROOMS';
      }

      const isAvailable = !hasMissingInventory && !hasInsufficientRooms && room.active;

      return {
        roomType: room,
        checkIn,
        checkOut,
        nights,
        requestedRooms,
        minAvailableRooms,
        isAvailable,
        availabilityStatus,
        breakdown,
      };
    }

    // In-memory fallback
    let minAvailableRooms = Infinity;
    let hasMissingInventory = false;
    let hasInsufficientRooms = false;
    const breakdown = [];

    for (const date of stayDates) {
      const overrideKey = `${roomTypeId}_${date}`;
      let availableRooms;

      if (this.inMemoryInventory.has(overrideKey)) {
        const val = this.inMemoryInventory.get(overrideKey);
        if (val === null || val === undefined) {
          // Explicitly deleted / missing
          availableRooms = null;
        } else {
          availableRooms = val;
        }
      } else {
        // Default baseline availability equal to total_rooms
        availableRooms = room.totalRooms ?? 10;
      }

      if (availableRooms === null || availableRooms === undefined) {
        hasMissingInventory = true;
        minAvailableRooms = 0;
        breakdown.push({
          date,
          availableRooms: 0,
          hasInventory: false,
          sufficient: false,
        });
      } else {
        minAvailableRooms = Math.min(minAvailableRooms, availableRooms);
        const sufficient = availableRooms >= requestedRooms;
        if (!sufficient) hasInsufficientRooms = true;

        breakdown.push({
          date,
          availableRooms,
          hasInventory: true,
          sufficient,
        });
      }
    }

    if (minAvailableRooms === Infinity) minAvailableRooms = 0;

    let availabilityStatus = 'AVAILABLE';
    if (hasMissingInventory) {
      availabilityStatus = 'MISSING_INVENTORY';
    } else if (hasInsufficientRooms) {
      availabilityStatus = 'INSUFFICIENT_ROOMS';
    }

    const isAvailable = !hasMissingInventory && !hasInsufficientRooms && room.active;

    return {
      roomType: room,
      checkIn,
      checkOut,
      nights,
      requestedRooms,
      minAvailableRooms,
      isAvailable,
      availabilityStatus,
      breakdown,
    };
  }

  /**
   * Baseline availability check for booking transactions
   * @param {string} roomTypeId
   * @param {string} checkIn
   * @param {string} checkOut
   * @param {number} [rooms=1]
   * @returns {Promise<{ available: boolean, minAvailableRooms: number }>}
   */
  async checkAvailability(roomTypeId, checkIn, checkOut, rooms = 1) {
    const result = await this.checkDateWiseAvailability({
      roomTypeId,
      checkIn,
      checkOut,
      requestedRooms: rooms,
    });
    if (!result) return { available: false, minAvailableRooms: 0 };
    return {
      available: result.isAvailable,
      minAvailableRooms: result.minAvailableRooms,
    };
  }

  /**
   * Locks inventory rows for update during a booking transaction
   * @param {import('pg').PoolClient} client
   * @param {string} roomTypeId
   * @param {string} checkIn
   * @param {string} checkOut
   * @returns {Promise<Array<object>>}
   */
  async lockInventoryForUpdate(client, roomTypeId, checkIn, checkOut) {
    const sql = `
      SELECT inventory_date, available_rooms
      FROM room_inventory
      WHERE room_type_id = $1
        AND inventory_date >= $2::date
        AND inventory_date < $3::date
      ORDER BY inventory_date ASC
      FOR UPDATE;
    `;
    return (await client.query(sql, [roomTypeId, checkIn, checkOut])).rows;
  }

  /**
   * Decrements available rooms for each night in stay
   * @param {import('pg').PoolClient} client
   * @param {string} roomTypeId
   * @param {string} checkIn
   * @param {string} checkOut
   * @param {number} [rooms=1]
   * @returns {Promise<number>}
   */
  async decrementInventory(client, roomTypeId, checkIn, checkOut, rooms = 1) {
    const sql = `
      UPDATE room_inventory
      SET available_rooms = available_rooms - $4
      WHERE room_type_id = $1
        AND inventory_date >= $2::date
        AND inventory_date < $3::date
        AND available_rooms >= $4;
    `;
    const result = await client.query(sql, [roomTypeId, checkIn, checkOut, rooms]);
    return result.rowCount;
  }

  /**
   * Restores available rooms upon booking cancellation
   * @param {import('pg').PoolClient} client
   * @param {string} roomTypeId
   * @param {string} checkIn
   * @param {string} checkOut
   * @param {number} [rooms=1]
   * @returns {Promise<number>}
   */
  async incrementInventory(client, roomTypeId, checkIn, checkOut, rooms = 1) {
    const sql = `
      UPDATE room_inventory
      SET available_rooms = available_rooms + $4
      WHERE room_type_id = $1
        AND inventory_date >= $2::date
        AND inventory_date < $3::date;
    `;
    const result = await client.query(sql, [roomTypeId, checkIn, checkOut, rooms]);
    return result.rowCount;
  }
}

export const roomRepository = new RoomRepository();
export default roomRepository;
