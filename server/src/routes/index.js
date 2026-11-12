import { Router } from 'express';
import hotelRoutes from './hotel.routes.js';
import roomRoutes from './room.routes.js';
import bookingRoutes from './booking.routes.js';

const router = Router();

// Mount domain routes
router.use('/hotels', hotelRoutes);
router.use('/room-types', roomRoutes);
router.use('/bookings', bookingRoutes);

export default router;
