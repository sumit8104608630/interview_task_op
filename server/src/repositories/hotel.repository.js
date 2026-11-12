import { query, checkDatabaseConnection } from '../database/connection.js';
import { loadSeedData } from '../database/seeds/seed.js';

/**
 * Hotel Data Access Repository
 * Encapsulates all PostgreSQL queries for hotel properties, imagery, locations, and amenities.
 * Uses parameterized queries, correlated JSON aggregations (preventing N+1 queries), and in-memory test fallback.
 */
export class HotelRepository {
  constructor() {
    this.forceInMemory = false;
  }

  /**
   * Sets in-memory test mode
   * @param {boolean} flag
   */
  setForceInMemory(flag) {
    this.forceInMemory = flag;
  }

  async _usePostgres() {
    if (this.forceInMemory) return false;
    const health = await checkDatabaseConnection();
    return health.healthy;
  }

  /**
   * Retrieves a paginated list of active hotels with filters and sorting
   *
   * @param {object} params
   * @param {string} [params.locationId]
   * @param {string} [params.city]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {'name'|'price'|'created_at'} [params.sortBy='name']
   * @param {'asc'|'desc'} [params.sortOrder='asc']
   * @returns {Promise<{ hotels: Array<object>, total: number }>}
   */
  async findAll({
    locationId = null,
    city = null,
    page = 1,
    limit = 10,
    sortBy = 'name',
    sortOrder = 'asc',
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;
    const order = sortOrder?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    if (await this._usePostgres()) {
      const conditions = ['h.is_active = TRUE'];
      const values = [];

      if (locationId) {
        values.push(locationId);
        conditions.push(`h.location_id = $${values.length}::uuid`);
      }

      if (city && city.trim().length > 0) {
        values.push(`%${city.trim()}%`);
        conditions.push(`l.city ILIKE $${values.length}`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // 1. Total Count Query
      const countSql = `
        SELECT COUNT(DISTINCT h.id) AS total
        FROM hotels h
        JOIN locations l ON l.id = h.location_id
        ${whereClause};
      `;
      const countRes = await query(countSql, values);
      const total = parseInt(countRes.rows[0]?.total || 0, 10);

      // 2. Sorting clause
      let orderByClause = 'h.name ASC';
      if (sortBy === 'price') {
        orderByClause = `min_price ${order} NULLS LAST, h.name ASC`;
      } else if (sortBy === 'created_at') {
        orderByClause = `h.created_at ${order}, h.name ASC`;
      } else {
        orderByClause = `h.name ${order}`;
      }

      // 3. Paginated List Query with Subquery Aggregations (Prevents N+1)
      const listSql = `
        SELECT 
          h.id,
          h.name,
          h.slug,
          h.description,
          h.address_line,
          h.postal_code,
          h.is_active,
          h.created_at,
          json_build_object(
            'id', l.id,
            'city', l.city,
            'state', l.state,
            'country', l.country,
            'timezone', l.timezone
          ) AS location,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', hi.id,
                  'url', hi.secure_url,
                  'altText', hi.alt_text,
                  'displayOrder', hi.display_order
                ) ORDER BY hi.display_order ASC
              )
              FROM hotel_images hi
              WHERE hi.hotel_id = h.id
            ), '[]'::json
          ) AS images,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', a.id,
                  'code', a.code,
                  'name', a.name
                ) ORDER BY a.name ASC
              )
              FROM hotel_amenities ha
              JOIN amenities a ON a.id = ha.amenity_id
              WHERE ha.hotel_id = h.id
            ), '[]'::json
          ) AS amenities,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', rt.id,
                  'name', rt.name,
                  'description', rt.description,
                  'maxGuests', rt.max_guests,
                  'pricePerNight', rt.price_per_night,
                  'currency', rt.currency
                ) ORDER BY rt.price_per_night ASC
              )
              FROM room_types rt
              WHERE rt.hotel_id = h.id AND rt.active = TRUE
            ), '[]'::json
          ) AS room_categories,
          (
            SELECT MIN(rt.price_per_night)
            FROM room_types rt
            WHERE rt.hotel_id = h.id AND rt.active = TRUE
          ) AS min_price
        FROM hotels h
        JOIN locations l ON l.id = h.location_id
        ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2};
      `;

      const listValues = [...values, safeLimit, offset];
      const result = await query(listSql, listValues);

      const formatted = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        address: row.address_line,
        addressLine: row.address_line,
        postalCode: row.postal_code,
        isActive: row.is_active,
        is_active: row.is_active,
        location: row.location,
        images: row.images,
        amenities: row.amenities,
        roomCategories: row.room_categories,
        minPrice: row.min_price !== null ? Number(row.min_price) : null,
      }));

      return { hotels: formatted, total };
    }

    // In-memory fallback
    const allHotels = await loadSeedData();
    let filtered = allHotels.filter((h) => h.isActive || h.is_active);

    if (locationId) {
      filtered = filtered.filter((h) => h.location_id === locationId || h.location?.id === locationId);
    }

    if (city && city.trim().length > 0) {
      const term = city.trim().toLowerCase();
      filtered = filtered.filter(
        (h) => h.location?.city?.toLowerCase().includes(term)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'price') {
        const priceA = a.minPrice ?? 0;
        const priceB = b.minPrice ?? 0;
        return order === 'DESC' ? priceB - priceA : priceA - priceB;
      }
      if (sortBy === 'created_at') {
        return 0;
      }
      // default: name
      const comp = (a.name || '').localeCompare(b.name || '');
      return order === 'DESC' ? -comp : comp;
    });

    const paginated = filtered.slice(offset, offset + safeLimit);

    return {
      hotels: paginated,
      total: filtered.length,
    };
  }

  /**
   * Finds a hotel by UUID or slug
   * Only returns active hotels.
   *
   * @param {string} identifier - Hotel UUID or slug
   * @returns {Promise<object|null>}
   */
  async findById(identifier) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          h.id,
          h.name,
          h.slug,
          h.description,
          h.address_line,
          h.postal_code,
          h.is_active,
          h.created_at,
          h.updated_at,
          json_build_object(
            'id', l.id,
            'city', l.city,
            'state', l.state,
            'country', l.country,
            'timezone', l.timezone
          ) AS location,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', hi.id,
                  'url', hi.secure_url,
                  'altText', hi.alt_text,
                  'displayOrder', hi.display_order
                ) ORDER BY hi.display_order ASC
              )
              FROM hotel_images hi
              WHERE hi.hotel_id = h.id
            ), '[]'::json
          ) AS images,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', a.id,
                  'code', a.code,
                  'name', a.name
                ) ORDER BY a.name ASC
              )
              FROM hotel_amenities ha
              JOIN amenities a ON a.id = ha.amenity_id
              WHERE ha.hotel_id = h.id
            ), '[]'::json
          ) AS amenities,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', rt.id,
                  'name', rt.name,
                  'description', rt.description,
                  'maxGuests', rt.max_guests,
                  'pricePerNight', rt.price_per_night,
                  'currency', rt.currency,
                  'totalRooms', rt.total_rooms,
                  'active', rt.active
                ) ORDER BY rt.price_per_night ASC
              )
              FROM room_types rt
              WHERE rt.hotel_id = h.id AND rt.active = TRUE
            ), '[]'::json
          ) AS room_categories
        FROM hotels h
        JOIN locations l ON l.id = h.location_id
        WHERE (h.id::text = $1 OR h.slug = $1)
          AND h.is_active = TRUE
        LIMIT 1;
      `;
      const result = await query(sql, [identifier]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        address: row.address_line,
        addressLine: row.address_line,
        postalCode: row.postal_code,
        isActive: row.is_active,
        is_active: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        location: row.location,
        images: row.images,
        amenities: row.amenities,
        roomCategories: row.room_categories,
      };
    }

    // In-memory fallback
    const allHotels = await loadSeedData();
    const found = allHotels.find(
      (h) => (h.id === identifier || h.slug === identifier) && (h.isActive || h.is_active)
    );
    if (!found) return null;

    return { ...found };
  }

  /**
   * Finds a hotel by slug
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  async findBySlug(slug) {
    return this.findById(slug);
  }
}

export const hotelRepository = new HotelRepository();
export default hotelRepository;
