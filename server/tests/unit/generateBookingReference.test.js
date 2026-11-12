import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBookingReference } from '../../src/utils/generateBookingReference.js';

describe('Booking Reference Generator', () => {
  it('should generate reference matching HBP-XXXXXXXX format', () => {
    const reference = generateBookingReference();
    assert.match(reference, /^HBP-[2-9A-HJ-NP-Z]{8}$/);
  });

  it('should produce unique references on subsequent calls', () => {
    const set = new Set();
    for (let i = 0; i < 100; i += 1) {
      const ref = generateBookingReference();
      assert.equal(set.has(ref), false);
      set.add(ref);
    }
  });
});
