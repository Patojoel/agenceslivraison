import { z } from 'zod';

/** Only the shape of the body is guarded here; lengths, phone format and normalization are the domain's call. */
export const createAgencySiteRequest = z.object({
  name: z.string(),
  city: z.string(),
  address: z.string(),
  phone: z.string().nullable().optional(),
}).strict();
