import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkDatabaseConnection } from '../connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedCatalogue = null;
let cachedHotels = null;

/**
 * Loads the raw catalogue tables (locations, amenities, hotels, roomTypes, etc.)
 * @returns {Promise<{ locations: Array, amenities: Array, hotels: Array, roomTypes: Array, hotelAmenities: Array, hotelImages: Array }>}
 */
export const loadCatalogueData = async () => {
  if (cachedCatalogue) return cachedCatalogue;
  const filePath = path.resolve(__dirname, 'data/demo_catalogue.json');
  const rawData = await fs.readFile(filePath, 'utf-8');
  cachedCatalogue = JSON.parse(rawData);
  return cachedCatalogue;
};

/**
 * Loads the 100 fictional hotels dataset fully assembled with locations, images, amenities, and room types
 * @returns {Promise<Array<object>>}
 */
export const loadSeedData = async () => {
  if (cachedHotels) return cachedHotels;

  const catalogue = await loadCatalogueData();
  const { locations, amenities, hotels, roomTypes, hotelAmenities, hotelImages } = catalogue;

  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const amenityMap = new Map(amenities.map((a) => [a.id, a]));

  const hotelAmenitiesMap = new Map();
  for (const ha of hotelAmenities) {
    if (!hotelAmenitiesMap.has(ha.hotel_id)) {
      hotelAmenitiesMap.set(ha.hotel_id, []);
    }
    const am = amenityMap.get(ha.amenity_id);
    if (am) {
      hotelAmenitiesMap.get(ha.hotel_id).push(am);
    }
  }

  const hotelImagesMap = new Map();
  for (const img of hotelImages) {
    if (!hotelImagesMap.has(img.hotel_id)) {
      hotelImagesMap.set(img.hotel_id, []);
    }
    hotelImagesMap.get(img.hotel_id).push(img);
  }

  const hotelRoomsMap = new Map();
  for (const room of roomTypes) {
    if (!hotelRoomsMap.has(room.hotel_id)) {
      hotelRoomsMap.set(room.hotel_id, []);
    }
    hotelRoomsMap.get(room.hotel_id).push(room);
  }

  cachedHotels = hotels.map((h) => {
    const loc = locationMap.get(h.location_id) || {
      id: h.location_id,
      city: 'Unknown',
      state: 'Unknown',
      country: 'India',
      timezone: 'Asia/Kolkata',
    };

    const rawImgs = (hotelImagesMap.get(h.id) || []).sort((a, b) => a.display_order - b.display_order);
    const images = rawImgs.map((img) => ({
      id: img.id,
      url: img.secure_url,
      secure_url: img.secure_url,
      altText: img.alt_text,
      alt_text: img.alt_text,
      displayOrder: img.display_order,
      display_order: img.display_order,
    }));

    const ams = hotelAmenitiesMap.get(h.id) || [];
    const rms = (hotelRoomsMap.get(h.id) || []).filter((r) => r.active).map((r) => ({
      id: r.id,
      hotelId: r.hotel_id,
      hotel_id: r.hotel_id,
      name: r.name,
      description: r.description,
      maxGuests: r.max_guests,
      max_guests: r.max_guests,
      pricePerNight: r.price_per_night,
      price_per_night: r.price_per_night,
      currency: r.currency || 'INR',
      totalRooms: r.total_rooms,
      total_rooms: r.total_rooms,
      active: r.active,
    }));

    const minPrice = rms.length > 0 ? Math.min(...rms.map((r) => r.pricePerNight)) : null;

    return {
      id: h.id,
      location_id: h.location_id,
      name: h.name,
      slug: h.slug,
      description: h.description,
      address: h.address_line,
      addressLine: h.address_line,
      address_line: h.address_line,
      postalCode: h.postal_code,
      postal_code: h.postal_code,
      isActive: h.is_active,
      is_active: h.is_active,
      location: {
        id: loc.id,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        timezone: loc.timezone,
      },
      images,
      amenities: ams.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
      })),
      roomCategories: rms,
      minPrice,
    };
  });

  return cachedHotels;
};

/**
 * Database seed execution runner
 */
export const runSeed = async () => {
  console.log('[Seed Runner] Checking database connectivity before seeding...');
  const health = await checkDatabaseConnection();

  if (!health.healthy) {
    console.warn('[Seed Runner] Database is currently unreachable or offline:', health.error);
    return;
  }

  try {
    const hotels = await loadSeedData();
    console.log(`[Seed Runner] Loaded ${hotels.length} fictional hotels from seed dataset.`);
  } catch (error) {
    console.error('[Seed Runner] Error reading seed dataset:', error.message);
    throw error;
  }
};

// Allow direct CLI execution: node src/database/seeds/seed.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Runner Failure]', err);
      await pool.end();
      process.exit(1);
    });
}

export default runSeed;
