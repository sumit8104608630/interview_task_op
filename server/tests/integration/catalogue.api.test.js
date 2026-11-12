import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../../src/app.js';
import { hotelRepository } from '../../src/repositories/hotel.repository.js';
import { locationRepository } from '../../src/repositories/location.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { amenityRepository } from '../../src/repositories/amenity.repository.js';

describe('Hotel Catalogue & Locations API Integration Tests (Phase 2)', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Isolate test execution to in-memory catalogue store
    hotelRepository.setForceInMemory(true);
    locationRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);
    amenityRepository.setForceInMemory(true);

    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    hotelRepository.setForceInMemory(false);
    locationRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
    amenityRepository.setForceInMemory(false);

    await new Promise((resolve) => server.close(resolve));
  });

  // ==========================================
  // 1. HOTEL LISTING API
  // ==========================================

  it('1. GET /api/hotels returns 200 with active hotels, location, images, amenities, and room summaries', async () => {
    const res = await fetch(`${baseUrl}/api/hotels`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
    assert.equal(json.meta.total, 100);

    const firstHotel = json.data[0];
    assert.ok(firstHotel.id);
    assert.ok(firstHotel.name);
    assert.ok(firstHotel.slug);
    assert.ok(firstHotel.description);
    assert.ok(firstHotel.address);
    assert.ok(firstHotel.location);
    assert.ok(firstHotel.location.city);
    assert.ok(firstHotel.location.state);
    assert.ok(firstHotel.location.country);

    // Verify images
    assert.ok(Array.isArray(firstHotel.images));
    assert.ok(firstHotel.images.length > 0);
    assert.match(firstHotel.images[0].url, /^https?:\/\//i);
    assert.ok(firstHotel.images[0].altText);
    assert.equal(typeof firstHotel.images[0].displayOrder, 'number');

    // Verify amenities
    assert.ok(Array.isArray(firstHotel.amenities));
    assert.ok(firstHotel.amenities.length > 0);
    assert.ok(firstHotel.amenities[0].id);
    assert.ok(firstHotel.amenities[0].name);

    // Verify room category summary
    assert.ok(firstHotel.minPrice > 0);
    assert.ok(Array.isArray(firstHotel.roomCategories));
  });

  it('2. GET /api/hotels supports pagination with page and limit query parameters', async () => {
    const res = await fetch(`${baseUrl}/api/hotels?page=2&limit=5`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 5);
    assert.equal(json.meta.page, 2);
    assert.equal(json.meta.limit, 5);
    assert.equal(json.meta.total, 100);
    assert.equal(json.meta.totalPages, 20);
  });

  it('3. GET /api/hotels supports sorting by price ascending and descending', async () => {
    const resAsc = await fetch(`${baseUrl}/api/hotels?sortBy=price&sortOrder=asc&limit=10`);
    assert.equal(resAsc.status, 200);
    const jsonAsc = await resAsc.json();

    for (let i = 0; i < jsonAsc.data.length - 1; i++) {
      assert.ok(jsonAsc.data[i].minPrice <= jsonAsc.data[i + 1].minPrice);
    }

    const resDesc = await fetch(`${baseUrl}/api/hotels?sortBy=price&sortOrder=desc&limit=10`);
    assert.equal(resDesc.status, 200);
    const jsonDesc = await resDesc.json();

    for (let i = 0; i < jsonDesc.data.length - 1; i++) {
      assert.ok(jsonDesc.data[i].minPrice >= jsonDesc.data[i + 1].minPrice);
    }
  });

  it('4. GET /api/hotels supports sorting by name descending', async () => {
    const res = await fetch(`${baseUrl}/api/hotels?sortBy=name&sortOrder=desc&limit=5`);
    assert.equal(res.status, 200);

    const json = await res.json();
    for (let i = 0; i < json.data.length - 1; i++) {
      assert.ok(json.data[i].name.localeCompare(json.data[i + 1].name) >= 0);
    }
  });

  it('5. GET /api/hotels filters by city name', async () => {
    const res = await fetch(`${baseUrl}/api/hotels?city=Mumbai`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(json.data.length > 0);
    for (const h of json.data) {
      assert.match(h.location.city, /mumbai/i);
    }
  });

  it('6. GET /api/hotels returns empty results when no hotel matches the filter', async () => {
    const res = await fetch(`${baseUrl}/api/hotels?city=NonExistentCityXYZ`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 0);
    assert.equal(json.meta.total, 0);
  });

  it('7. GET /api/hotels filters by locationId', async () => {
    // Location ID for Mumbai in demo dataset
    const mumbaiLocId = '5bbd759d-659e-5a8c-8aa5-03abda3c0e07';
    const res = await fetch(`${baseUrl}/api/hotels?locationId=${mumbaiLocId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(json.data.length > 0);
    for (const h of json.data) {
      assert.equal(h.location.id, mumbaiLocId);
    }
  });

  // ==========================================
  // 2. HOTEL DETAILS API
  // ==========================================

  it('8. GET /api/hotels/:id returns structured hotel details by UUID', async () => {
    const hotelId = 'b4be4e93-6b2c-5fa7-aa09-ad72b3f341a7';
    const res = await fetch(`${baseUrl}/api/hotels/${hotelId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.id, hotelId);
    assert.equal(json.data.name, 'Grand Residency Mumbai 001');
    assert.equal(json.data.slug, 'grand-residency-mumbai-001');
    assert.ok(json.data.description);
    assert.ok(json.data.address);
    assert.ok(json.data.postalCode);
    assert.equal(json.data.location.city, 'Mumbai');

    // Images
    assert.ok(Array.isArray(json.data.images));
    assert.ok(json.data.images.length >= 2);
    assert.equal(json.data.images[0].displayOrder, 0);
    assert.equal(json.data.images[1].displayOrder, 1);
    assert.match(json.data.images[0].url, /^https:\/\/images\.unsplash\.com\//);

    // Amenities
    assert.ok(Array.isArray(json.data.amenities));
    assert.ok(json.data.amenities.length > 0);
    assert.ok(json.data.amenities[0].code);

    // Room categories
    assert.ok(Array.isArray(json.data.roomCategories));
    assert.ok(json.data.roomCategories.length > 0);
    assert.equal(json.data.roomCategories[0].name, 'Superior King Room');
    assert.equal(json.data.roomCategories[0].maxGuests, 2);
    assert.equal(json.data.roomCategories[0].pricePerNight, 3199);
    assert.equal(json.data.roomCategories[0].currency, 'INR');
  });

  it('9. GET /api/hotels/:slug returns structured hotel details by slug', async () => {
    const slug = 'royal-suites-pune-002';
    const res = await fetch(`${baseUrl}/api/hotels/${slug}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.slug, slug);
    assert.equal(json.data.name, 'Royal Suites Pune 002');
    assert.equal(json.data.location.city, 'Pune');
  });

  it('10. GET /api/hotels/:id returns 404 for unknown hotel ID', async () => {
    const res = await fetch(`${baseUrl}/api/hotels/00000000-0000-0000-0000-000000000000`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'HOTEL_NOT_FOUND');
  });

  // ==========================================
  // 3. ROOM CATEGORIES API
  // ==========================================

  it('11. GET /api/hotels/:id/rooms returns active room types for the hotel', async () => {
    const hotelId = 'b4be4e93-6b2c-5fa7-aa09-ad72b3f341a7';
    const res = await fetch(`${baseUrl}/api/hotels/${hotelId}/rooms`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);

    const room = json.data[0];
    assert.equal(room.hotelId, hotelId);
    assert.equal(room.name, 'Superior King Room');
    assert.equal(room.maxGuests, 2);
    assert.equal(room.pricePerNight, 3199);
    assert.equal(room.currency, 'INR');
    assert.equal(room.active, true);
  });

  it('12. GET /api/hotels/:id/rooms returns 404 when hotel does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/hotels/non-existent-hotel-id/rooms`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'HOTEL_NOT_FOUND');
  });

  // ==========================================
  // 4. LOCATIONS API
  // ==========================================

  it('13. GET /api/locations returns available hotel locations with city, state, country', async () => {
    const res = await fetch(`${baseUrl}/api/locations`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.equal(json.data.length, 20); // 20 distinct Indian cities in demo dataset

    const firstLoc = json.data[0];
    assert.ok(firstLoc.id);
    assert.ok(firstLoc.city);
    assert.ok(firstLoc.state);
    assert.ok(firstLoc.country);
    assert.ok(firstLoc.timezone);
    assert.ok(firstLoc.hotelCount > 0);
  });

  it('14. GET /api/locations/:id returns single location by UUID', async () => {
    const locId = '5bbd759d-659e-5a8c-8aa5-03abda3c0e07';
    const res = await fetch(`${baseUrl}/api/locations/${locId}`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.id, locId);
    assert.equal(json.data.city, 'Mumbai');
    assert.equal(json.data.state, 'Maharashtra');
    assert.equal(json.data.country, 'India');
  });

  it('15. GET /api/locations/:id returns 404 for unknown location', async () => {
    const res = await fetch(`${baseUrl}/api/locations/unknown-location-identifier`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'NOT_FOUND');
  });

  // ==========================================
  // 5. AMENITIES API
  // ==========================================

  it('16. GET /api/amenities returns available hotel amenities', async () => {
    const res = await fetch(`${baseUrl}/api/amenities`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.equal(json.data.length, 15); // 15 amenities defined

    const wifi = json.data.find((a) => a.code === 'WIFI');
    assert.ok(wifi);
    assert.equal(wifi.name, 'Free Wi-Fi');
  });

  // ==========================================
  // 6. COMPATIBILITY ACROSS /api and /api/v1
  // ==========================================

  it('17. Catalogue endpoints are accessible via both /api and /api/v1 prefixes', async () => {
    const resV1Hotels = await fetch(`${baseUrl}/api/v1/hotels?limit=1`);
    assert.equal(resV1Hotels.status, 200);

    const resV1Locations = await fetch(`${baseUrl}/api/v1/locations?limit=1`);
    assert.equal(resV1Locations.status, 200);

    const resV1Amenities = await fetch(`${baseUrl}/api/v1/amenities`);
    assert.equal(resV1Amenities.status, 200);
  });
});
