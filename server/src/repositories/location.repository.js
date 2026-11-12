import { query, checkDatabaseConnection } from '../database/connection.js';
import { loadCatalogueData } from '../database/seeds/seed.js';

/**
 * Location Data Access Repository
 * Handles queries for hotel locations (cities, states, countries).
 */
export class LocationRepository {
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
   * Retrieves all available hotel locations with optional pagination
   * Avoids duplicate results and filters out locations without active hotels.
   *
   * @param {object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @returns {Promise<{ locations: Array<object>, total: number }>}
   */
  async findAll({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;

    if (await this._usePostgres()) {
      const countSql = `
        SELECT COUNT(DISTINCT l.id) AS total
        FROM locations l
        JOIN hotels h ON h.location_id = l.id AND h.is_active = TRUE;
      `;
      const countRes = await query(countSql);
      const total = parseInt(countRes.rows[0]?.total || 0, 10);

      const listSql = `
        SELECT 
          l.id,
          l.city,
          l.state,
          l.country,
          l.timezone,
          COUNT(h.id) FILTER (WHERE h.is_active = TRUE) AS active_hotel_count
        FROM locations l
        JOIN hotels h ON h.location_id = l.id AND h.is_active = TRUE
        GROUP BY l.id, l.city, l.state, l.country, l.timezone
        ORDER BY l.city ASC
        LIMIT $1 OFFSET $2;
      `;
      const result = await query(listSql, [limit, offset]);

      const formatted = result.rows.map((row) => ({
        id: row.id,
        city: row.city,
        state: row.state,
        country: row.country,
        timezone: row.timezone,
        hotelCount: parseInt(row.active_hotel_count, 10),
      }));

      return { locations: formatted, total };
    }

    // In-memory fallback
    const catalogue = await loadCatalogueData();
    const activeHotelLocIds = new Set(
      catalogue.hotels.filter((h) => h.is_active).map((h) => h.location_id)
    );

    const activeLocations = catalogue.locations
      .filter((l) => activeHotelLocIds.has(l.id))
      .sort((a, b) => a.city.localeCompare(b.city))
      .map((l) => {
        const count = catalogue.hotels.filter((h) => h.location_id === l.id && h.is_active).length;
        return {
          id: l.id,
          city: l.city,
          state: l.state,
          country: l.country,
          timezone: l.timezone,
          hotelCount: count,
        };
      });

    const paginated = activeLocations.slice(offset, offset + limit);
    return {
      locations: paginated,
      total: activeLocations.length,
    };
  }

  /**
   * Finds a location by ID (UUID) or city name
   * @param {string} identifier - Location UUID or city
   * @returns {Promise<object|null>}
   */
  async findById(identifier) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          l.id,
          l.city,
          l.state,
          l.country,
          l.timezone,
          COUNT(h.id) FILTER (WHERE h.is_active = TRUE) AS active_hotel_count
        FROM locations l
        LEFT JOIN hotels h ON h.location_id = l.id AND h.is_active = TRUE
        WHERE l.id::text = $1 OR LOWER(l.city) = LOWER($1)
        GROUP BY l.id, l.city, l.state, l.country, l.timezone
        LIMIT 1;
      `;
      const result = await query(sql, [identifier]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        city: row.city,
        state: row.state,
        country: row.country,
        timezone: row.timezone,
        hotelCount: parseInt(row.active_hotel_count || 0, 10),
      };
    }

    // In-memory fallback
    const catalogue = await loadCatalogueData();
    const loc = catalogue.locations.find(
      (l) => l.id === identifier || l.city.toLowerCase() === identifier.toLowerCase()
    );
    if (!loc) return null;

    const count = catalogue.hotels.filter((h) => h.location_id === loc.id && h.is_active).length;
    return {
      id: loc.id,
      city: loc.city,
      state: loc.state,
      country: loc.country,
      timezone: loc.timezone,
      hotelCount: count,
    };
  }
}

export const locationRepository = new LocationRepository();
export default locationRepository;
