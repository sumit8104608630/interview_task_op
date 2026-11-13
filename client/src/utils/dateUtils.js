/**
 * Date utilities for stay validation, formatting, and duration calculation
 */

/**
 * Returns current date in YYYY-MM-DD format
 * @returns {string}
 */
export const getTodayIsoString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns tomorrow or N days after a given date in YYYY-MM-DD format
 * @param {string} [baseDateIso]
 * @param {number} [daysOffset=1]
 * @returns {string}
 */
export const getFutureDateIsoString = (baseDateIso, daysOffset = 1) => {
  const base = baseDateIso ? new Date(baseDateIso) : new Date();
  base.setDate(base.getDate() + daysOffset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculates calendar nights between checkIn and checkOut
 * @param {string} checkIn - YYYY-MM-DD
 * @param {string} checkOut - YYYY-MM-DD
 * @returns {number}
 */
export const calculateNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diffTime = outDate.getTime() - inDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Formats YYYY-MM-DD into readable editorial string (e.g. "1 Dec 2026" or "Dec 1, 2026")
 * @param {string} isoString
 * @param {boolean} [includeWeekday=false]
 * @returns {string}
 */
export const formatDisplayDate = (isoString, includeWeekday = false) => {
  if (!isoString) return '—';
  try {
    const [year, month, day] = isoString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    if (isNaN(date.getTime())) return isoString;

    const options = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(includeWeekday ? { weekday: 'short' } : {}),
    };
    return new Intl.DateTimeFormat('en-IN', options).format(date);
  } catch {
    return isoString;
  }
};

/**
 * Validates checkIn and checkOut stay interval client-side
 * @param {string} checkIn
 * @param {string} checkOut
 * @param {number} [maxStayNights=30]
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateStayDates = (checkIn, checkOut, maxStayNights = 30) => {
  if (!checkIn) {
    return { valid: false, error: 'Check-in date is required.' };
  }
  if (!checkOut) {
    return { valid: false, error: 'Check-out date is required.' };
  }

  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(checkIn) || !isoRegex.test(checkOut)) {
    return { valid: false, error: 'Dates must be in YYYY-MM-DD format.' };
  }

  const today = getTodayIsoString();
  if (checkIn < today) {
    return { valid: false, error: 'Check-in date cannot be in the past.' };
  }

  if (checkOut <= checkIn) {
    return { valid: false, error: 'Check-out date must be strictly after check-in date.' };
  }

  const nights = calculateNights(checkIn, checkOut);
  if (nights > maxStayNights) {
    return { valid: false, error: `Maximum allowable stay duration is ${maxStayNights} nights.` };
  }

  return { valid: true };
};
