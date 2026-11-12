/**
 * Date utility functions for hotel booking calendar calculations
 * Adheres strictly to calendar-date differences and [check-in, check-out) intervals.
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a string is a valid YYYY-MM-DD calendar date
 * @param {string} dateString
 * @returns {boolean}
 */
export const isValidIsoDate = (dateString) => {
  if (typeof dateString !== 'string' || !ISO_DATE_REGEX.test(dateString)) {
    return false;
  }
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/**
 * Converts a YYYY-MM-DD date string to a UTC Date object set to 00:00:00
 * @param {string} dateString
 * @returns {Date}
 */
export const parseIsoDateToUtc = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC (or specified timezone)
 * @returns {string}
 */
export const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculates the exact calendar nights between check-in and check-out
 * Uses UTC calendar date arithmetic to prevent daylight saving time / millisecond rounding bugs.
 * @param {string} checkIn - 'YYYY-MM-DD'
 * @param {string} checkOut - 'YYYY-MM-DD'
 * @returns {number} Number of nights (calendar days)
 */
export const calculateNights = (checkIn, checkOut) => {
  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    throw new Error('Invalid ISO date format. Expected YYYY-MM-DD.');
  }

  const inUtc = parseIsoDateToUtc(checkIn);
  const outUtc = parseIsoDateToUtc(checkOut);

  const diffMs = outUtc.getTime() - inUtc.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(diffMs / msPerDay);
};

/**
 * Generates an array of individual calendar dates consumed during the stay [checkIn, checkOut)
 * Notice that checkOut date is excluded from consumed inventory nights.
 * @param {string} checkIn - 'YYYY-MM-DD'
 * @param {string} checkOut - 'YYYY-MM-DD'
 * @returns {Array<string>} Array of 'YYYY-MM-DD' strings
 */
export const getStayDates = (checkIn, checkOut) => {
  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) {
    throw new Error('Check-out date must be strictly after check-in date.');
  }

  const dates = [];
  const current = parseIsoDateToUtc(checkIn);

  for (let i = 0; i < nights; i += 1) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

/**
 * Validates check-in and check-out dates against business rules:
 * 1. Both must be valid YYYY-MM-DD dates
 * 2. Check-in must not be in the past
 * 3. Check-out must be after check-in
 * @param {string} checkIn
 * @param {string} checkOut
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateStayDates = (checkIn, checkOut) => {
  if (!isValidIsoDate(checkIn)) {
    return { valid: false, error: 'Check-in must be a valid date in YYYY-MM-DD format.' };
  }
  if (!isValidIsoDate(checkOut)) {
    return { valid: false, error: 'Check-out must be a valid date in YYYY-MM-DD format.' };
  }

  const today = getTodayIsoDate();
  if (checkIn < today) {
    return { valid: false, error: 'Check-in date cannot be in the past.' };
  }

  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) {
    return { valid: false, error: 'Check-out date must be strictly later than check-in date.' };
  }

  return { valid: true };
};

export default {
  isValidIsoDate,
  parseIsoDateToUtc,
  getTodayIsoDate,
  calculateNights,
  getStayDates,
  validateStayDates,
};
