import { z } from 'zod';
import { MAX_PARCELS_PER_QUOTE } from '../../../domain/rate-card-version';

const parcel = z.object({
  /** A weight with its unit, such as `0,8 kg` or `800 g`. */
  weight: z.string().max(32),
  /** The three or none, in centimetres, the unit being explicit. */
  dimensions: z.object({ length: z.number(), width: z.number(), height: z.number(), unit: z.literal('cm') }).strict().nullable().optional(),
}).strict();

export const previewQuoteRequest = z.object({
  zoneId: z.string().uuid(),
  parcels: z.array(parcel).max(MAX_PARCELS_PER_QUOTE),
}).strict();
