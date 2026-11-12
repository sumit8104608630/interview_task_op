import { Router } from 'express';
import { locationController } from '../controllers/location.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { getLocationsQuerySchema, locationIdParamSchema } from '../validators/location.validator.js';

const router = Router();

/**
 * @route   GET /api/locations
 * @desc    Get all available hotel locations
 * @access  Public
 */
router.get('/', validate({ query: getLocationsQuerySchema }), locationController.listLocations);

/**
 * @route   GET /api/locations/:id
 * @desc    Get single location details by ID or city
 * @access  Public
 */
router.get('/:id', validate({ params: locationIdParamSchema }), locationController.getLocationById);

export default router;
