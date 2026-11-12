import { amenityService } from '../services/amenity.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Controller handling Amenity HTTP Endpoints
 */
export class AmenityController {
  /**
   * GET /api/amenities
   * Returns list of all available hotel amenities
   */
  listAmenities = asyncHandler(async (req, res) => {
    const amenities = await amenityService.getAmenities();

    return sendSuccess(res, {
      statusCode: 200,
      data: amenities,
      meta: {
        total: amenities.length,
      },
    });
  });
}

export const amenityController = new AmenityController();
export default amenityController;
