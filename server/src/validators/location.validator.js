import { z } from 'zod';

export const getLocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});

export const locationIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Location identifier is required.'),
});

export default {
  getLocationsQuerySchema,
  locationIdParamSchema,
};
