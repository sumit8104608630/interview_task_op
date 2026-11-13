/**
 * Formats a monetary number into Indian Rupee or specified currency representation
 * @param {number|string} amount
 * @param {string} [currency='INR']
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return '—';
  }

  const num = Number(amount);

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  }
};

/**
 * Returns formatted nights string (e.g., "1 night", "3 nights")
 * @param {number} count
 * @returns {string}
 */
export const formatNights = (count) => {
  const n = Math.max(1, Number(count) || 1);
  return `${n} ${n === 1 ? 'night' : 'nights'}`;
};

/**
 * Generates an architectural luxury category badge based on hotel attributes
 * @param {string} [hotelName='']
 * @returns {string}
 */
export const getLuxuryCategoryBadge = (hotelName = '') => {
  const name = (hotelName || '').toLowerCase();
  if (name.includes('palace') || name.includes('fort') || name.includes('haveli')) {
    return 'HERITAGE PALACE';
  }
  if (name.includes('beach') || name.includes('cove') || name.includes('sea') || name.includes('bay')) {
    return 'COASTAL RESORT';
  }
  if (name.includes('villa') || name.includes('retreat')) {
    return 'PRIVATE RETREAT';
  }
  if (name.includes('residence') || name.includes('estate')) {
    return 'HISTORIC ESTATE';
  }
  return 'BOUTIQUE SANCTUARY';
};

/**
 * High-resolution fallback imagery for luxury estates
 */
export const LUXURY_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
];

export const getFallbackImage = (index = 0) => {
  return LUXURY_FALLBACK_IMAGES[index % LUXURY_FALLBACK_IMAGES.length];
};
