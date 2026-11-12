import { Router } from 'express';
import { amenityController } from '../controllers/amenity.controller.js';

const router = Router();

/**
 * @route   GET /api/amenities
 * @desc    Get all available hotel amenities
 * @access  Public
 */
router.get('/', amenityController.listAmenities);

export default router;
