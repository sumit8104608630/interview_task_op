import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../../src/app.js';
import { hotelRepository } from '../../src/repositories/hotel.repository.js';
import { locationRepository } from '../../src/repositories/location.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { amenityRepository } from '../../src/repositories/amenity.repository.js';

describe('Hotel Search and Room Availability API Integration Tests (Phase 3)', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Isolate tests to in-memory catalogue store for fast, deterministic execution
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

  afterEach(() => {
    // Reset test inventory overrides after each test
    roomRepository.resetInventory();
  });

  // Future valid stay dates (well ahead in 2026/2027)
  const validCheckIn = '2026-12-01';
  const validCheckOut = '2026-12-04'; // 3 nights: Dec 1, 2, 3

  // ==========================================
  // 1. HOTEL SEARCH API: BASIC FUNCTIONALITY
  // ==========================================

  it('1. GET /api/hotels/search returns 200 with available hotels, room categories, pricing, and stay metadata', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&guests=2&rooms=1`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
    assert.ok(json.meta);
    assert.equal(json.meta.stay.checkIn, validCheckIn);
    assert.equal(json.meta.stay.checkOut, validCheckOut);
    assert.equal(json.meta.stay.nights, 3);
    assert.equal(json.meta.stay.guests, 2);
    assert.equal(json.meta.stay.rooms, 1);

    const firstHotel = json.data[0];
    assert.ok(firstHotel.id);
    assert.ok(firstHotel.name);
    assert.ok(firstHotel.location);
    assert.equal(firstHotel.location.city.toLowerCase(), 'mumbai');
    assert.ok(Array.isArray(firstHotel.images));
    assert.ok(Array.isArray(firstHotel.amenities));
    assert.ok(Array.isArray(firstHotel.availableRoomCategories));
    assert.ok(firstHotel.availableRoomCategories.length > 0);

    const firstRoom = firstHotel.availableRoomCategories[0];
    assert.ok(firstRoom.id);
    assert.ok(firstRoom.name);
    assert.ok(firstRoom.pricePerNight > 0);
    assert.equal(firstRoom.nights, 3);
    assert.equal(firstRoom.totalStayAmount, firstRoom.pricePerNight * 3 * 1);
  });

  it('2. GET /api/v1/hotels/search also routes to search successfully (v1 compatibility)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/hotels/search?city=Delhi&checkIn=${validCheckIn}&checkOut=${validCheckOut}&guests=1&rooms=1`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
    assert.ok(json.data[0].location.city.toLowerCase().includes('delhi'));
  });

  // ==========================================
  // 2. DATE VALIDATION RULES
  // ==========================================

  it('3. GET /api/hotels/search rejects check-out equal to check-in (0 nights) with 400 INVALID_DATE_RANGE', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=2026-12-01&checkOut=2026-12-01`
    );
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_DATE_RANGE');
  });

  it('4. GET /api/hotels/search rejects check-out earlier than check-in with 400 INVALID_DATE_RANGE', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=2026-12-05&checkOut=2026-12-02`
    );
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_DATE_RANGE');
  });

  it('5. GET /api/hotels/search rejects past check-in dates with 400 PAST_CHECK_IN_DATE', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=2020-01-01&checkOut=2020-01-05`
    );
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'PAST_CHECK_IN_DATE');
  });

  it('6. GET /api/hotels/search rejects stays exceeding maximum 30 nights with 400 STAY_DURATION_EXCEEDED', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=2026-12-01&checkOut=2027-01-10` // 40 nights
    );
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'STAY_DURATION_EXCEEDED');
  });

  it('7. GET /api/hotels/search rejects malformed dates with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=not-a-date&checkOut=2026-12-05`
    );
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  // ==========================================
  // 3. INVENTORY AVAILABILITY & EXCLUSIONS
  // ==========================================

  it('8. Missing inventory record on any stay night excludes that room category', async () => {
    // First, find Mumbai hotels
    const resInitial = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=1`
    );
    const initialJson = await resInitial.json();
    const hotel = initialJson.data[0];
    const roomId = hotel.availableRoomCategories[0].id;

    // Simulate missing inventory on the 2nd night (Dec 2)
    roomRepository.deleteInventory(roomId, '2026-12-02');

    // Query availability for that specific room
    const availRes = await fetch(
      `${baseUrl}/api/rooms/availability?roomTypeId=${roomId}&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=1`
    );
    assert.equal(availRes.status, 200);
    const availJson = await availRes.json();

    assert.equal(availJson.data.isAvailable, false);
    assert.equal(availJson.data.availabilityStatus, 'MISSING_INVENTORY');
    assert.equal(availJson.data.availableRooms, 0);

    // Verify breakdown highlights missing date
    const dec2 = availJson.data.breakdown.find((b) => b.date === '2026-12-02');
    assert.ok(dec2);
    assert.equal(dec2.sufficient, false);
    assert.equal(dec2.availableRooms, 0);
  });

  it('9. Insufficient room count on any stay night marks room as INSUFFICIENT_ROOMS', async () => {
    const resInitial = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=1`
    );
    const initialJson = await resInitial.json();
    const hotel = initialJson.data[0];
    const roomId = hotel.availableRoomCategories[0].id;

    // Set available rooms on Dec 2 to only 1 room
    roomRepository.setInventory(roomId, '2026-12-02', 1);

    // Check with rooms=2
    const availRes = await fetch(
      `${baseUrl}/api/rooms/availability?roomTypeId=${roomId}&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=2`
    );
    assert.equal(availRes.status, 200);
    const availJson = await availRes.json();

    assert.equal(availJson.data.isAvailable, false);
    assert.equal(availJson.data.availabilityStatus, 'INSUFFICIENT_ROOMS');
    assert.equal(availJson.data.availableRooms, 1);
  });

  it('10. Checkout-exclusive date: 0 inventory on check-out date does NOT affect stay', async () => {
    const resInitial = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=1`
    );
    const initialJson = await resInitial.json();
    const hotel = initialJson.data[0];
    const roomId = hotel.availableRoomCategories[0].id;

    // Set inventory on checkOut date (2026-12-04) to 0 or missing
    // Since stay is Dec 1 to Dec 4, required nights are Dec 1, 2, 3 only!
    roomRepository.setInventory(roomId, '2026-12-04', 0);

    const availRes = await fetch(
      `${baseUrl}/api/rooms/availability?roomTypeId=${roomId}&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=1`
    );
    assert.equal(availRes.status, 200);
    const availJson = await availRes.json();

    assert.equal(availJson.data.isAvailable, true);
    assert.equal(availJson.data.availabilityStatus, 'AVAILABLE');
    assert.equal(availJson.data.requestedDates.nights, 3);
  });

  it('11. Multiple room requests: search with rooms=3 verifies available_rooms >= 3 across all nights', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&guests=3&rooms=3`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (const h of json.data) {
      for (const room of h.availableRoomCategories) {
        assert.ok(room.availableRooms >= 3);
        assert.equal(room.totalStayAmount, room.pricePerNight * 3 * 3);
      }
    }
  });

  // ==========================================
  // 4. CAPACITY & FILTERING
  // ==========================================

  it('12. Guest capacity filtering: guests=6 with rooms=1 requires room maxGuests >= 6', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&guests=6&rooms=1`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (const h of json.data) {
      for (const room of h.availableRoomCategories) {
        assert.ok(room.maxGuests >= 6);
      }
    }
  });

  it('13. Price range filtering: minPrice and maxPrice constrain available rooms and hotels', async () => {
    const minPrice = 3000;
    const maxPrice = 6000;

    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&minPrice=${minPrice}&maxPrice=${maxPrice}`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (const h of json.data) {
      assert.ok(h.minPrice >= minPrice);
      for (const room of h.availableRoomCategories) {
        assert.ok(room.pricePerNight >= minPrice);
        assert.ok(room.pricePerNight <= maxPrice);
      }
    }
  });

  it('14. Amenities filtering: returns only hotels that offer all specified amenities', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}&amenities=WIFI,POOL`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (const h of json.data) {
      const codes = h.amenities.map((a) => a.code.toUpperCase());
      assert.ok(codes.includes('WIFI'));
      assert.ok(codes.includes('POOL'));
    }
  });

  // ==========================================
  // 5. SORTING AND PAGINATION
  // ==========================================

  it('15. Sorting by lowest_price / price asc orders hotels from cheapest to most expensive', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?checkIn=${validCheckIn}&checkOut=${validCheckOut}&sortBy=lowest_price`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (let i = 0; i < json.data.length - 1; i += 1) {
      assert.ok(json.data[i].minPrice <= json.data[i + 1].minPrice);
    }
  });

  it('16. Sorting by highest_price / price desc orders hotels from most expensive to cheapest', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?checkIn=${validCheckIn}&checkOut=${validCheckOut}&sortBy=highest_price`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (let i = 0; i < json.data.length - 1; i += 1) {
      assert.ok(json.data[i].minPrice >= json.data[i + 1].minPrice);
    }
  });

  it('17. Sorting by name orders hotels alphabetically', async () => {
    const res = await fetch(
      `${baseUrl}/api/hotels/search?checkIn=${validCheckIn}&checkOut=${validCheckOut}&sortBy=name&sortOrder=asc`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    for (let i = 0; i < json.data.length - 1; i += 1) {
      const comp = json.data[i].name.localeCompare(json.data[i + 1].name);
      assert.ok(comp <= 0);
    }
  });

  it('18. Pagination: page and limit correctly partition search results', async () => {
    const resPage1 = await fetch(
      `${baseUrl}/api/hotels/search?checkIn=${validCheckIn}&checkOut=${validCheckOut}&page=1&limit=5`
    );
    const json1 = await resPage1.json();
    assert.equal(json1.data.length, 5);
    assert.equal(json1.meta.page, 1);
    assert.equal(json1.meta.limit, 5);
    assert.ok(json1.meta.totalPages >= 1);

    const resPage2 = await fetch(
      `${baseUrl}/api/hotels/search?checkIn=${validCheckIn}&checkOut=${validCheckOut}&page=2&limit=5`
    );
    const json2 = await resPage2.json();
    assert.equal(json2.data.length, 5);
    assert.equal(json2.meta.page, 2);

    // Ensure pages do not have overlapping first item
    assert.notEqual(json1.data[0].id, json2.data[0].id);
  });

  // ==========================================
  // 6. ROOM AVAILABILITY ENDPOINTS
  // ==========================================

  it('19. GET /api/rooms/availability returns structured stay, capacity, pricing, and availability status without internal inventory IDs', async () => {
    // Get a valid room type ID
    const searchRes = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}`
    );
    const searchJson = await searchRes.json();
    const roomId = searchJson.data[0].availableRoomCategories[0].id;

    const res = await fetch(
      `${baseUrl}/api/rooms/availability?roomTypeId=${roomId}&checkIn=${validCheckIn}&checkOut=${validCheckOut}&rooms=2`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data);

    // Verify response schema
    assert.equal(json.data.requestedDates.checkIn, validCheckIn);
    assert.equal(json.data.requestedDates.checkOut, validCheckOut);
    assert.equal(json.data.requestedDates.nights, 3);
    assert.equal(json.data.requestedDates.requestedRooms, 2);

    assert.ok(json.data.roomType);
    assert.equal(json.data.roomType.id, roomId);
    assert.ok(json.data.roomType.name);
    assert.ok(json.data.totalRooms);
    assert.ok(typeof json.data.availableRooms === 'number');
    assert.equal(json.data.availabilityStatus, 'AVAILABLE');
    assert.equal(json.data.isAvailable, true);

    // Pricing
    assert.equal(
      json.data.pricing.totalAmount,
      json.data.pricing.nightlyRate * 3 * 2
    );

    // Breakdown
    assert.equal(json.data.breakdown.length, 3);
    for (const b of json.data.breakdown) {
      assert.ok(b.date);
      assert.ok(typeof b.availableRooms === 'number');
      assert.equal(b.sufficient, true);
      // Ensure NO internal database IDs are exposed
      assert.equal(b.id, undefined);
      assert.equal(b.inventory_id, undefined);
    }
  });

  it('20. GET /api/rooms/availability returns 404 for unknown or non-existent roomTypeId', async () => {
    const res = await fetch(
      `${baseUrl}/api/rooms/availability?roomTypeId=00000000-0000-0000-0000-000000000000&checkIn=${validCheckIn}&checkOut=${validCheckOut}`
    );
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'ROOM_NOT_FOUND');
  });

  it('21. GET /api/v1/room-types/:id/availability backwards compatibility works seamlessly', async () => {
    const searchRes = await fetch(
      `${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${validCheckIn}&checkOut=${validCheckOut}`
    );
    const searchJson = await searchRes.json();
    const roomId = searchJson.data[0].availableRoomCategories[0].id;

    const res = await fetch(
      `${baseUrl}/api/v1/room-types/${roomId}/availability?checkIn=${validCheckIn}&checkOut=${validCheckOut}`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.roomType.id, roomId);
  });
});
