import crypto from 'crypto';
import { query, checkDatabaseConnection } from '../../database/connection.js';
import { devStorage } from '../../database/devStorage.js';

/**
 * Customer and Auth Session Data Access Repository
 * Handles all PostgreSQL queries for customer accounts, password management, and sessions.
 * Employs parameterized SQL queries and an in-memory fallback for isolated testing.
 */
export class AuthRepository {
  constructor() {
    this.inMemoryCustomers = new Map();
    this.inMemorySessions = new Map();
    this.forceInMemory = false;
    this._loadDevStore();
  }

  _loadDevStore() {
    if (this.forceInMemory) return;
    const customers = devStorage.getSection('customers');
    if (customers && Array.isArray(customers)) {
      for (const c of customers) {
        this.inMemoryCustomers.set(c.id, c);
      }
    }
    const sessions = devStorage.getSection('sessions');
    if (sessions && Array.isArray(sessions)) {
      for (const s of sessions) {
        this.inMemorySessions.set(s.id, s);
      }
    }
  }

  _persistDevStore() {
    if (this.forceInMemory) return;
    devStorage.write('customers', Array.from(this.inMemoryCustomers.values()));
    devStorage.write('sessions', Array.from(this.inMemorySessions.values()));
  }

  /**
   * Enables or disables explicit in-memory storage mode (used in isolated unit tests)
   * @param {boolean} flag
   */
  setForceInMemory(flag) {
    this.forceInMemory = flag;
    devStorage.setDisabled(flag);
    if (!flag) {
      this.inMemoryCustomers.clear();
      this.inMemorySessions.clear();
      this._loadDevStore();
    }
  }

  /**
   * Checks whether to execute against PostgreSQL or fallback store
   * @private
   */
  async _usePostgres() {
    if (this.forceInMemory) return false;
    const health = await checkDatabaseConnection();
    return health.healthy;
  }

  /**
   * Finds a customer by normalized (case-insensitive) email
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findCustomerByEmail(email) {
    const normalized = email.trim().toLowerCase();

    if (await this._usePostgres()) {
      const sql = `
        SELECT id, email, full_name, password_hash, phone, email_verified_at, status, last_login_at, created_at, updated_at
        FROM customers
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1;
      `;
      const result = await query(sql, [normalized]);
      return result.rows[0] || null;
    }

    // In-memory fallback
    for (const customer of this.inMemoryCustomers.values()) {
      if (customer.email.toLowerCase() === normalized) {
        return { ...customer };
      }
    }
    return null;
  }

  /**
   * Finds a customer by unique UUID
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findCustomerById(id) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT id, email, full_name, password_hash, phone, email_verified_at, status, last_login_at, created_at, updated_at
        FROM customers
        WHERE id = $1
        LIMIT 1;
      `;
      const result = await query(sql, [id]);
      return result.rows[0] || null;
    }

    const customer = this.inMemoryCustomers.get(id);
    return customer ? { ...customer } : null;
  }

  /**
   * Creates a new customer record
   * Uses ON CONFLICT to safely handle concurrent registration attempts on duplicate emails.
   *
   * @param {object} params
   * @param {string} [params.id]
   * @param {string} params.email
   * @param {string} params.fullName
   * @param {string|null} [params.passwordHash]
   * @param {string} [params.phone]
   * @returns {Promise<object>} Created or existing customer row
   */
  async createCustomer({ id = crypto.randomUUID(), email, fullName, passwordHash = null, phone = null }) {
    const normalized = email.trim().toLowerCase();
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        INSERT INTO customers (
          id, email, full_name, password_hash, phone, email_verified_at, status, last_login_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $6, $6, $6)
        ON CONFLICT (LOWER(email)) DO UPDATE
          SET last_login_at = EXCLUDED.last_login_at,
              email_verified_at = COALESCE(customers.email_verified_at, EXCLUDED.email_verified_at),
              password_hash = COALESCE(EXCLUDED.password_hash, customers.password_hash),
              updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const result = await query(sql, [id, normalized, fullName.trim(), passwordHash, phone, now]);
      return result.rows[0];
    }

    // In-memory fallback with conflict handling
    for (const existing of this.inMemoryCustomers.values()) {
      if (existing.email.toLowerCase() === normalized) {
        existing.last_login_at = now;
        existing.email_verified_at = existing.email_verified_at || now;
        if (passwordHash) existing.password_hash = passwordHash;
        existing.updated_at = now;
        return { ...existing };
      }
    }

    const newCustomer = {
      id,
      email: normalized,
      full_name: fullName.trim(),
      password_hash: passwordHash,
      phone,
      email_verified_at: now,
      status: 'ACTIVE',
      last_login_at: now,
      created_at: now,
      updated_at: now,
    };
    this.inMemoryCustomers.set(id, newCustomer);
    this._persistDevStore();
    return { ...newCustomer };
  }

  /**
   * Updates customer password hash
   * @param {string} customerId
   * @param {string} passwordHash
   * @returns {Promise<object|null>}
   */
  async updatePassword(customerId, passwordHash) {
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        UPDATE customers
        SET password_hash = $1, updated_at = $2
        WHERE id = $3
        RETURNING *;
      `;
      const result = await query(sql, [passwordHash, now, customerId]);
      return result.rows[0] || null;
    }

    const customer = this.inMemoryCustomers.get(customerId);
    if (customer) {
      customer.password_hash = passwordHash;
      customer.updated_at = now;
      this._persistDevStore();
      return { ...customer };
    }
    return null;
  }

  /**
   * Updates last_login_at timestamp for an authenticated customer
   * @param {string} customerId
   * @returns {Promise<object|null>}
   */
  async updateLastLogin(customerId) {
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        UPDATE customers
        SET last_login_at = $1, updated_at = $1
        WHERE id = $2
        RETURNING *;
      `;
      const result = await query(sql, [now, customerId]);
      return result.rows[0] || null;
    }

    const customer = this.inMemoryCustomers.get(customerId);
    if (customer) {
      customer.last_login_at = now;
      customer.updated_at = now;
      this._persistDevStore();
      return { ...customer };
    }
    return null;
  }

  /**
   * Updates customer status (e.g. 'ACTIVE', 'DISABLED')
   * @param {string} customerId
   * @param {'ACTIVE'|'DISABLED'|'SUSPENDED'} status
   * @returns {Promise<object|null>}
   */
  async updateCustomerStatus(customerId, status) {
    if (await this._usePostgres()) {
      const sql = `
        UPDATE customers
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `;
      const result = await query(sql, [status, customerId]);
      return result.rows[0] || null;
    }

    const customer = this.inMemoryCustomers.get(customerId);
    if (customer) {
      customer.status = status;
      this._persistDevStore();
      return { ...customer };
    }
    return null;
  }

  /**
   * Persists an authentication session in auth_sessions table
   * Session ID corresponds directly to JWT jti claim.
   *
   * @param {object} params
   * @param {string} [params.id]
   * @param {string} params.customerId
   * @param {string} [params.userAgent]
   * @param {Date} params.expiresAt
   * @returns {Promise<object>}
   */
  async createSession({ id = crypto.randomUUID(), customerId, userAgent = 'Unknown', expiresAt }) {
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        INSERT INTO auth_sessions (id, customer_id, user_agent, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const result = await query(sql, [id, customerId, userAgent, expiresAt, now]);
      return result.rows[0];
    }

    const session = {
      id,
      customer_id: customerId,
      user_agent: userAgent,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: now,
    };
    this.inMemorySessions.set(id, session);
    this._persistDevStore();
    return { ...session };
  }

  /**
   * Finds an active, non-expired, non-revoked session along with customer status
   *
   * @param {string} sessionId - Corresponds to JWT jti
   * @returns {Promise<object|null>}
   */
  async findActiveSessionWithCustomer(sessionId) {
    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          s.id AS session_id,
          s.customer_id,
          s.user_agent,
          s.expires_at,
          s.revoked_at,
          c.id,
          c.email,
          c.full_name,
          c.password_hash,
          c.phone,
          c.status,
          c.last_login_at
        FROM auth_sessions s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.id = $1
        LIMIT 1;
      `;
      const result = await query(sql, [sessionId]);
      return result.rows[0] || null;
    }

    const session = this.inMemorySessions.get(sessionId);
    if (!session) return null;

    const customer = this.inMemoryCustomers.get(session.customer_id);
    if (!customer) return null;

    return {
      session_id: session.id,
      customer_id: session.customer_id,
      user_agent: session.user_agent,
      expires_at: session.expires_at,
      revoked_at: session.revoked_at,
      id: customer.id,
      email: customer.email,
      full_name: customer.full_name,
      password_hash: customer.password_hash,
      phone: customer.phone,
      status: customer.status,
      last_login_at: customer.last_login_at,
    };
  }

  /**
   * For testing: forcibly expires a session
   * @param {string} sessionId
   */
  async expireSessionForTesting(sessionId) {
    const past = new Date(Date.now() - 10000);
    if (await this._usePostgres()) {
      const sql = `UPDATE auth_sessions SET expires_at = $1 WHERE id = $2;`;
      await query(sql, [past, sessionId]);
      return;
    }
    const session = this.inMemorySessions.get(sessionId);
    if (session) {
      session.expires_at = past;
    }
  }

  /**
   * Revokes an authentication session by setting revoked_at timestamp
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async revokeSession(sessionId) {
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        UPDATE auth_sessions
        SET revoked_at = $1
        WHERE id = $2 AND revoked_at IS NULL
        RETURNING id;
      `;
      const result = await query(sql, [now, sessionId]);
      return result.rowCount > 0;
    }

    const session = this.inMemorySessions.get(sessionId);
    if (session && !session.revoked_at) {
      session.revoked_at = now;
      this._persistDevStore();
      return true;
    }
    return false;
  }

  /**
   * Revokes all active sessions for a customer (e.g. upon password reset)
   * @param {string} customerId
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeAllCustomerSessions(customerId) {
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        UPDATE auth_sessions
        SET revoked_at = $1
        WHERE customer_id = $2 AND revoked_at IS NULL;
      `;
      const result = await query(sql, [now, customerId]);
      return result.rowCount;
    }

    let count = 0;
    for (const session of this.inMemorySessions.values()) {
      if (session.customer_id === customerId && !session.revoked_at) {
        session.revoked_at = now;
        count += 1;
      }
    }
    if (count > 0) {
      this._persistDevStore();
    }
    return count;
  }
}

export const authRepository = new AuthRepository();
export default authRepository;
