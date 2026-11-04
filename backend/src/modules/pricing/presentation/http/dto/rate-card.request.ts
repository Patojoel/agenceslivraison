import { z } from 'zod';
import { MAX_TIERS_PER_ZONE, MAX_ZONES_PER_VERSION } from '../../../domain/rate-card-content';

const tier = z.object({
  /** A weight with its unit, such as `1 kg` or `1000 g`: the domain reads it. */
  upTo: z.string().max(32),
  /** A whole number of CFA francs. */
  price: z.number(),
}).strict();

const line = z.object({
  zoneId: z.string().uuid(),
  tiers: z.array(tier).max(MAX_TIERS_PER_ZONE),
}).strict();

/**
 * The complete scale, for the creation of the rate card and for each new version. Only the shape and the sizes are
 * guarded here; units, bounds and prices are the domain's call. The currency can only be `XAF`.
 */
export const rateCardRequest = z.object({
  currency: z.literal('XAF').optional(),
  volumetricDivisor: z.number().nullable().optional(),
  lines: z.array(line).max(MAX_ZONES_PER_VERSION),
}).strict();

/** The version number of a path: a whole number from 1 to 999 999 999. */
export const versionNumberParam = z.string().regex(/^[1-9][0-9]{0,8}$/).transform(Number);

/** Query string `limit` of the history: 20 when absent, otherwise an integer from 1 to 50. */
export const versionsLimitParam = z.union([
  z.undefined().transform(() => 20),
  z.string().transform(Number).pipe(z.number().int().min(1).max(50)),
]);

/** Query string `cursor` of the history: the number of the last version of the previous page. */
export const versionsCursorParam = z.union([z.undefined().transform(() => null), versionNumberParam]);
