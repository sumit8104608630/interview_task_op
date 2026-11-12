import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNights,
  getStayDates,
  isValidIsoDate,
  validateStayDates,
} from '../../src/utils/dateUtils.js';

describe('Date Utilities (dateUtils.js)', () => {
  it('should accurately validate ISO date format YYYY-MM-DD', () => {
    assert.equal(isValidIsoDate('2026-11-15'), true);
    assert.equal(isValidIsoDate('2026-02-29'), false); // Non-leap year
    assert.equal(isValidIsoDate('15-11-2026'), false);
    assert.equal(isValidIsoDate('invalid-date'), false);
  });

  it('should calculate calendar nights difference accurately', () => {
    const nights = calculateNights('2026-11-15', '2026-11-18');
    assert.equal(nights, 3);
  });

  it('should return exactly [checkIn, checkOut) stay dates (excluding checkout)', () => {
    const stayDates = getStayDates('2026-11-15', '2026-11-18');
    assert.deepEqual(stayDates, [
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
    ]);
    assert.equal(stayDates.includes('2026-11-18'), false);
  });

  it('should reject past check-in dates', () => {
    const result = validateStayDates('2020-01-01', '2020-01-05');
    assert.equal(result.valid, false);
    assert.match(result.error, /past/i);
  });

  it('should reject check-out that is equal to or earlier than check-in', () => {
    const resultSameDay = validateStayDates('2026-12-01', '2026-12-01');
    assert.equal(resultSameDay.valid, false);

    const resultEarlier = validateStayDates('2026-12-05', '2026-12-02');
    assert.equal(resultEarlier.valid, false);
  });
});
