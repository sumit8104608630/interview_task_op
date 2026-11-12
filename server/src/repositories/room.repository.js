import { query, checkDatabaseConnection } from '../database/connection.js';
import { loadCatalogueData } from '../database/seeds/seed.js';

/**
 * Room and Inventory Data Access Repository
 * Encapsulates PostgreSQL queries for room categories, pricing, and nightly inventory.
 * Uses parameterized queries and row-level locking patterns.
 */
export class RoomRepository {
  constructor() {
    this.forceInMemory = false;
  }

  setForceInMemory(flag) {
    this.forceInMemory = flag;
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
          rt.name,
          rt.description,
          rt.max_guests AS "maxGuests",
          rt.price_per_night AS "pricePerNight",
          rt.currency,
          rt.total_rooms AS "totalRooms",
          rt.active
        FROM room_types rt
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

    return {
      id: r.id,
      hotelId: r.hotel_id,
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
   * Checks inventory availability for a room type across a stay interval [checkIn, checkOut)
   * @param {string} roomTypeId
   * @param {string} checkIn - 'YYYY-MM-DD'
   * @param {string} checkOut - 'YYYY-MM-DD'
   * @returns {Promise<{ available: boolean, minAvailableRooms: number }>}
   */
  async checkAvailability(roomTypeId, checkIn, checkOut) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          inventory_date,
          available_rooms
        FROM room_inventory
        WHERE room_type_id = $1
          AND inventory_date >= $2
          AND inventory_date < $3
        ORDER BY inventory_date ASC;
      `;
      const result = await query(sql, [roomTypeId, checkIn, checkOut]);
      const rows = result.rows;
      if (rows.length === 0) return { available: false, minAvailableRooms: 0 };
      const minRooms = Math.min(...rows.map((r) => r.available_rooms));
      return { available: minRooms >= 1, minAvailableRooms: minRooms };
    }

    return { available: true, minAvailableRooms: 10 };
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
        AND inventory_date >= $2
        AND inventory_date < $3
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
   * @returns {Promise<number>}
   */
  async decrementInventory(client, roomTypeId, checkIn, checkOut) {
    const sql = `
      UPDATE room_inventory
      SET available_rooms = available_rooms - 1
      WHERE room_type_id = $1
        AND inventory_date >= $2
        AND inventory_date < $3
        AND available_rooms >= 1;
    `;
    const result = await client.query(sql, [roomTypeId, checkIn, checkOut]);
    return result.rowCount;
  }

  /**
   * Restores available rooms upon booking cancellation
   * @param {import('pg').PoolClient} client
   * @param {string} roomTypeId
   * @param {string} checkIn
   * @param {string} checkOut
   * @returns {Promise<number>}
   */
  async incrementInventory(client, roomTypeId, checkIn, checkOut) {
    const sql = `
      UPDATE room_inventory
      SET available_rooms = available_rooms + 1
      WHERE room_type_id = $1
        AND inventory_date >= $2
        AND inventory_date < $3;
    `;
    const result = await client.query(sql, [roomTypeId, checkIn, checkOut]);
    return result.rowCount;
  }
}

export const roomRepository = new RoomRepository();
export default roomRepository;
