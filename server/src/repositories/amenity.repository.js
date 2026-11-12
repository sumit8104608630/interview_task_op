import { query, checkDatabaseConnection } from '../database/connection.js';
import { loadCatalogueData } from '../database/seeds/seed.js';

/**
 * Amenity Data Access Repository
 * Handles queries for hotel amenities (Wi-Fi, Pool, Gym, etc.).
 */
export class AmenityRepository {
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
   * Retrieves all available hotel amenities
   * @returns {Promise<Array<object>>}
   */
  async findAll() {
    if (await this._usePostgres()) {
      const sql = `
        SELECT id, code, name
        FROM amenities
        ORDER BY name ASC;
      `;
      const result = await query(sql);
      return result.rows;
    }

    const catalogue = await loadCatalogueData();
    return catalogue.amenities.map((a) => ({ ...a })).sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const amenityRepository = new AmenityRepository();
export default amenityRepository;
