import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, '.dev_fallback_store.json');

/**
 * Lightweight local persistent storage for development fallback mode.
 * Ensures customer accounts, passwords, sessions, and bookings do not get wiped
 * when the server restarts if local PostgreSQL credentials are not yet configured.
 */
class DevStorage {
  constructor() {
    this.disabled = process.env.NODE_ENV === 'test';
  }

  setDisabled(flag) {
    this.disabled = Boolean(flag);
  }

  read() {
    if (this.disabled) return {};
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      // Ignore read errors gracefully
    }
    return {};
  }

  write(section, items) {
    if (this.disabled) return;
    try {
      const current = this.read();
      current[section] = items;
      fs.writeFileSync(STORE_PATH, JSON.stringify(current, null, 2), 'utf-8');
    } catch (err) {
      // Ignore write errors gracefully
    }
  }

  getSection(section) {
    const data = this.read();
    return data[section] || null;
  }
}

export const devStorage = new DevStorage();
export default devStorage;
