import { z } from 'zod';
import { MAX_PARCELS_PER_QUOTE } from '../../../domain/rate-card-version';

/** A parcel of a simulation or a quote: the same shape, read by the same domain function. */
export const parcelRequest = z.object({
  /** A weight with its unit, such as `0,8 kg` or `800 g`. */
  weight: z.string().max(32),
  /** The three or none, in centimetres, the unit being explicit. */
  dimensions: z.object({ length: z.number(), width: z.number(), height: z.number(), unit: z.literal('cm') }).strict().nullable().optional(),
}).strict();

export const previewQuoteRequest = z.object({
  zoneId: z.string().uuid(),
  parcels: z.array(parcelRequest).max(MAX_PARCELS_PER_QUOTE),
}).strict();

/** The parcels as the domain reads them: the unit of the dimensions was checked here and is not carried further. */
export function rawParcelsOf(parcels: readonly z.output<typeof parcelRequest>[]): { weight: string; dimensions: { length: number; width: number; height: number } | null }[] {
  return parcels.map(parcel => ({ weight: parcel.weight, dimensions: parcel.dimensions ? { length: parcel.dimensions.length, width: parcel.dimensions.width, height: parcel.dimensions.height } : null }));
}
