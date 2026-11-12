import { query, checkDatabaseConnection } from '../database/connection.js';
import { loadSeedData } from '../database/seeds/seed.js';
import { roomRepository } from './room.repository.js';
import { calculateNights, getStayDates } from '../utils/dateUtils.js';

/**
 * Hotel Data Access Repository
 * Encapsulates all PostgreSQL queries for hotel properties, imagery, locations, amenities, and availability search.
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
   * Searches active hotels that have date-wise room availability for the requested stay
   *
   * @param {object} params
   * @param {string} [params.city]
   * @param {string} [params.locationId]
   * @param {string} params.checkIn - YYYY-MM-DD
   * @param {string} params.checkOut - YYYY-MM-DD
   * @param {number} [params.guests=1]
   * @param {number} [params.rooms=1]
   * @param {number} [params.minPrice]
   * @param {number} [params.maxPrice]
   * @param {Array<string>} [params.amenities] - Array of amenity codes
   * @param {'price'|'lowest_price'|'highest_price'|'name'} [params.sortBy='price']
   * @param {'asc'|'desc'} [params.sortOrder='asc']
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ hotels: Array<object>, total: number }>}
   */
  async searchAvailableHotels({
    city = null,
    locationId = null,
    checkIn,
    checkOut,
    guests = 1,
    rooms = 1,
    minPrice = null,
    maxPrice = null,
    amenities = null,
    sortBy = 'price',
    sortOrder = 'asc',
    page = 1,
    limit = 10,
  }) {
    const nights = calculateNights(checkIn, checkOut);
    const stayDates = getStayDates(checkIn, checkOut);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    // Normalizing sort parameters
    let normalizedSortBy = 'price';
    let normalizedSortOrder = sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (sortBy === 'lowest_price') {
      normalizedSortBy = 'price';
      normalizedSortOrder = 'asc';
    } else if (sortBy === 'highest_price') {
      normalizedSortBy = 'price';
      normalizedSortOrder = 'desc';
    } else if (sortBy === 'name') {
      normalizedSortBy = 'name';
    }

    const orderSql = normalizedSortOrder === 'desc' ? 'DESC' : 'ASC';

    if (await this._usePostgres()) {
      const amenityArray = Array.isArray(amenities) && amenities.length > 0 ? amenities : null;
      const minGuestsPerRoom = Math.ceil(guests / rooms);

      const sql = `
        WITH available_rooms_per_hotel AS (
          SELECT 
            rt.hotel_id,
            rt.id AS room_type_id,
            rt.name AS room_name,
            rt.description AS room_description,
            rt.max_guests,
            rt.price_per_night,
            rt.currency,
            MIN(ri.available_rooms) AS min_available_rooms
          FROM room_types rt
          JOIN room_inventory ri ON ri.room_type_id = rt.id
          WHERE rt.active = TRUE
            AND rt.max_guests >= $1
            AND ri.inventory_date >= $2::date
            AND ri.inventory_date < $3::date
            AND ri.available_rooms >= $4
          GROUP BY rt.hotel_id, rt.id, rt.name, rt.description, rt.max_guests, rt.price_per_night, rt.currency
          HAVING COUNT(ri.inventory_date) = $5
            AND ($6::numeric IS NULL OR rt.price_per_night >= $6::numeric)
            AND ($7::numeric IS NULL OR rt.price_per_night <= $7::numeric)
        ),
        matching_hotels AS (
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
            (
              SELECT json_agg(
                json_build_object(
                  'id', ar.room_type_id,
                  'name', ar.room_name,
                  'description', ar.room_description,
                  'maxGuests', ar.max_guests,
                  'pricePerNight', ar.price_per_night,
                  'currency', ar.currency,
                  'availableRooms', ar.min_available_rooms,
                  'nights', $5,
                  'totalStayAmount', ar.price_per_night * $5 * $4
                ) ORDER BY ar.price_per_night ASC
              )
              FROM available_rooms_per_hotel ar
              WHERE ar.hotel_id = h.id
            ) AS available_room_categories,
            MIN(ar.price_per_night) AS min_price,
            MIN(ar.price_per_night) * $5 * $4 AS min_total_stay_price
          FROM hotels h
          JOIN locations l ON l.id = h.location_id
          JOIN available_rooms_per_hotel ar ON ar.hotel_id = h.id
          WHERE h.is_active = TRUE
            AND ($8::uuid IS NULL OR h.location_id = $8::uuid)
            AND ($9::text IS NULL OR l.city ILIKE $9)
            AND (
              $10::text[] IS NULL OR
              (
                SELECT COUNT(DISTINCT a.code)
                FROM hotel_amenities ha
                JOIN amenities a ON a.id = ha.amenity_id
                WHERE ha.hotel_id = h.id AND a.code = ANY($10::text[])
              ) = cardinality($10::text[])
            )
          GROUP BY h.id, h.name, h.slug, h.description, h.address_line, h.postal_code, h.is_active, h.created_at, l.id, l.city, l.state, l.country, l.timezone
        )
        SELECT *, (SELECT COUNT(*) FROM matching_hotels) AS total_count
        FROM matching_hotels
        ORDER BY
          CASE WHEN $11 = 'price' AND $12 = 'asc' THEN min_price END ASC,
          CASE WHEN $11 = 'price' AND $12 = 'desc' THEN min_price END DESC,
          CASE WHEN $11 = 'name' AND $12 = 'asc' THEN name END ASC,
          CASE WHEN $11 = 'name' AND $12 = 'desc' THEN name END DESC,
          name ASC
        LIMIT $13 OFFSET $14;
      `;

      const cityFilter = city ? `%${city.trim()}%` : null;
      const values = [
        minGuestsPerRoom, // $1
        checkIn,          // $2
        checkOut,         // $3
        rooms,            // $4
        nights,           // $5
        minPrice,         // $6
        maxPrice,         // $7
        locationId,       // $8
        cityFilter,       // $9
        amenityArray,     // $10
        normalizedSortBy, // $11
        normalizedSortOrder, // $12
        safeLimit,        // $13
        offset,           // $14
      ];

      const result = await query(sql, values);
      const total = parseInt(result.rows[0]?.total_count || 0, 10);

      const hotels = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        address: row.address_line,
        addressLine: row.address_line,
        postalCode: row.postal_code,
        isActive: row.is_active,
        location: row.location,
        images: row.images,
        amenities: row.amenities,
        availableRoomCategories: row.available_room_categories || [],
        minPrice: row.min_price !== null ? Number(row.min_price) : null,
        minTotalStayPrice: row.min_total_stay_price !== null ? Number(row.min_total_stay_price) : null,
      }));

      return { hotels, total };
    }

    // In-memory fallback
    const allHotels = await loadSeedData();
    const minGuestsPerRoom = Math.ceil(guests / rooms);
    const matchedHotels = [];

    for (const h of allHotels) {
      if (!h.isActive && !h.is_active) continue;

      // Location / city filter
      if (locationId && h.location_id !== locationId && h.location?.id !== locationId) {
        continue;
      }
      if (city && city.trim().length > 0) {
        const queryTerm = city.trim().toLowerCase();
        if (!h.location?.city?.toLowerCase().includes(queryTerm)) {
          continue;
        }
      }

      // Amenity filter: hotel must have all requested amenities
      if (Array.isArray(amenities) && amenities.length > 0) {
        const hotelCodes = new Set((h.amenities || []).map((a) => a.code.toUpperCase()));
        const hasAll = amenities.every((code) => hotelCodes.has(code.toUpperCase()));
        if (!hasAll) continue;
      }

      // Check available room categories for this stay
      const availableRoomsForHotel = [];

      for (const room of (h.roomCategories || [])) {
        if (!room.active) continue;
        if (room.maxGuests < minGuestsPerRoom) continue;
        if (minPrice !== null && room.pricePerNight < minPrice) continue;
        if (maxPrice !== null && room.pricePerNight > maxPrice) continue;

        // Check date-wise inventory
        const availability = await roomRepository.checkDateWiseAvailability({
          roomTypeId: room.id,
          checkIn,
          checkOut,
          requestedRooms: rooms,
        });

        if (availability && availability.isAvailable) {
          availableRoomsForHotel.push({
            id: room.id,
            name: room.name,
            description: room.description,
            maxGuests: room.maxGuests,
            pricePerNight: room.pricePerNight,
            currency: room.currency,
            availableRooms: availability.minAvailableRooms,
            nights,
            totalStayAmount: room.pricePerNight * nights * rooms,
          });
        }
      }

      // Only include hotel if it has at least one available room category
      if (availableRoomsForHotel.length > 0) {
        availableRoomsForHotel.sort((a, b) => a.pricePerNight - b.pricePerNight);
        const minPriceFound = availableRoomsForHotel[0].pricePerNight;

        matchedHotels.push({
          id: h.id,
          name: h.name,
          slug: h.slug,
          description: h.description,
          address: h.address,
          addressLine: h.addressLine || h.address,
          postalCode: h.postalCode,
          isActive: true,
          location: h.location,
          images: h.images,
          amenities: h.amenities,
          availableRoomCategories: availableRoomsForHotel,
          minPrice: minPriceFound,
          minTotalStayPrice: minPriceFound * nights * rooms,
        });
      }
    }

    // Sort matched hotels
    matchedHotels.sort((a, b) => {
      if (normalizedSortBy === 'price') {
        return normalizedSortOrder === 'desc'
          ? b.minPrice - a.minPrice
          : a.minPrice - b.minPrice;
      }
      const comp = (a.name || '').localeCompare(b.name || '');
      return normalizedSortOrder === 'desc' ? -comp : comp;
    });

    const paginated = matchedHotels.slice(offset, offset + safeLimit);

    return {
      hotels: paginated,
      total: matchedHotels.length,
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
