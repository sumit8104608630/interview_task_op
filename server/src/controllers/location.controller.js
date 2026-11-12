import { locationService } from '../services/location.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Controller handling Location HTTP Endpoints
 */
export class LocationController {
  /**
   * GET /api/locations
   * Returns list of available hotel locations
   */
  listLocations = asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await locationService.getLocations({ page, limit });

    return sendSuccess(res, {
      statusCode: 200,
      data: result.locations,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * GET /api/locations/:id
   * Returns single location details
   */
  getLocationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const location = await locationService.getLocationById(id);

    return sendSuccess(res, {
      statusCode: 200,
      data: location,
    });
  });
}

export const locationController = new LocationController();
export default locationController;
