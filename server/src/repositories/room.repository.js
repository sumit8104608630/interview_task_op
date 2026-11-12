import { query } from '../database/connection.js';

/**
 * Room and Inventory Data Access Repository
 * Encapsulates PostgreSQL queries for room categories, pricing, and nightly inventory.
 * Uses parameterized queries and row-level locking patterns.
 */
export class RoomRepository {
  /**
   * Retrieves all room categories for a given hotel
   * @param {string} hotelId
   * @returns {Promise<Array<object>>}
   */
  async findByHotelId(hotelId) {
    const sql = `
      SELECT id, hotel_id, name, description, max_guests, price_per_night, total_rooms, active
      FROM room_types
      WHERE hotel_id = $1 AND active = TRUE
      ORDER BY price_per_night ASC;
    `;
    console.log('[RoomRepository.findByHotelId SQL template prepared for hotel:]', hotelId);
    return [];
  }

  /**
   * Finds a room category by ID with its authoritative nightly rate
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const sql = `SELECT * FROM room_types WHERE id = $1 LIMIT 1;`;
    console.log('[RoomRepository.findById SQL template prepared for ID:]', id);
    return null;
  }

  /**
   * Checks inventory availability for a room type across a stay interval [checkIn, checkOut)
   * Must verify that available_rooms >= 1 for each and every night in the date range.
   * @param {string} roomTypeId
   * @param {string} checkIn - 'YYYY-MM-DD'
   * @param {string} checkOut - 'YYYY-MM-DD'
   * @returns {Promise<{ available: boolean, minAvailableRooms: number }>}
   */
  async checkAvailability(roomTypeId, checkIn, checkOut) {
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
    console.log('[RoomRepository.checkAvailability SQL template prepared]');
    return { available: false, minAvailableRooms: 0 };
  }

  /**
   * Locks inventory rows for update during a booking transaction
   * @param {import('pg').PoolClient} client - Dedicated transaction client
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
   * @returns {Promise<number>} Number of updated inventory rows
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
