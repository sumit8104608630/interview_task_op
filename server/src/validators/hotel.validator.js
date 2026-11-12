import { z } from 'zod';
import { isValidIsoDate } from '../utils/dateUtils.js';

/**
 * Validation schema for query parameters when listing hotels
 */
export const getHotelsQuerySchema = z.object({
  city: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
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
 * Validation schema for route parameters with hotel ID
 */
export const hotelIdParamSchema = z.object({
  hotelId: z.string().trim().min(1, 'Hotel ID is required'),
});

export default {
  getHotelsQuerySchema,
  searchHotelsQuerySchema,
  hotelIdParamSchema,
};
