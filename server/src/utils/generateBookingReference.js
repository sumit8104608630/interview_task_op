import crypto from 'crypto';

// Unambiguous alphanumeric alphabet (excludes 0, O, 1, I to prevent user transcription confusion)
const CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a clean, collision-resistant, human-friendly booking reference
 * Format: HBP-XXXXXXXX (e.g. HBP-7K8M9PQ2)
 * @param {string} [prefix='HBP'] - Application-specific prefix
 * @param {number} [length=8] - Random suffix length
 * @returns {string} Formatted booking reference string
 */
export const generateBookingReference = (prefix = 'HBP', length = 8) => {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += CHARACTERS[bytes[i] % CHARACTERS.length];
  }
  return `${prefix}-${result}`;
};

export default generateBookingReference;
