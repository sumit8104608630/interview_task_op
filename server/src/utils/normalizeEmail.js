/**
 * Normalizes an email address by trimming whitespace and converting to lowercase
 * Ensures consistent email matching across database lookups and uniqueness checks.
 *
 * @param {string} email - Raw email input
 * @returns {string} Normalized email
 */
export const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
};

export default normalizeEmail;
