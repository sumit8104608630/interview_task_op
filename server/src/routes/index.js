import { Router } from 'express';
import hotelRoutes from './hotel.routes.js';
import locationRoutes from './location.routes.js';
import amenityRoutes from './amenity.routes.js';
import roomRoutes from './room.routes.js';
import bookingRoutes from './booking.routes.js';

const router = Router();

// Mount domain catalogue, room, and booking routes
router.use('/locations', locationRoutes);
router.use('/amenities', amenityRoutes);
router.use('/hotels', hotelRoutes);
router.use('/rooms', roomRoutes);
router.use('/room-types', roomRoutes);
router.use('/bookings', bookingRoutes);

export default router;
