import { z } from 'zod';
import { isValidIsoDate } from '../utils/dateUtils.js';

/**
 * Validation schema for query parameters when listing hotels
 */
export const getHotelsQuerySchema = z.object({
  locationId: z.string().trim().uuid('Invalid location UUID.').optional(),
  city: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
  sortBy: z.enum(['name', 'price', 'created_at']).default('name').optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc').optional(),
});

/**
 * Validation schema for hotel search by destination and date range
 */
export const searchHotelsQuerySchema = z.object({
  destination: z.string().trim().min(1, 'Destination is required'),
  checkIn: z.string().refine(isValidIsoDate, {
    message: 'checkIn must be a valid date in YYYY-MM-DD format',
  }),
  checkOut: z.string().refine(isValidIsoDate, {
    message: 'checkOut must be a valid date in YYYY-MM-DD format',
  }),
  guests: z.coerce.number().int().positive().default(1),
});

/**
 * Validation schema for route parameters with hotel ID or slug
 */
export const hotelIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Hotel identifier is required.').optional(),
  hotelId: z.string().trim().min(1, 'Hotel identifier is required.').optional(),
});

export default {
  getHotelsQuerySchema,
  searchHotelsQuerySchema,
  hotelIdParamSchema,
};
