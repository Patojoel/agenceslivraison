import { z } from 'zod';
import { MAX_PARCELS_PER_QUOTE } from '../../../domain/rate-card-version';
import { decodeQuoteCursor } from '../../../application/queries/list-quotes/quote-cursor';
import { parcelRequest } from './preview-quote.request';

/**
 * The quote of a recipient. Only shapes and sizes are guarded here: names, phone numbers, prices and reasons are the
 * domain's call. The agency comes from the path and the author from the session, never from the body.
 */
export const issueQuoteRequest = z.object({
  recipient: z.object({
    name: z.string().max(200),
    phone: z.string().max(32).nullable().optional(),
  }).strict(),
  zoneId: z.string().uuid(),
  parcels: z.array(parcelRequest).max(MAX_PARCELS_PER_QUOTE),
  /** The price a member retains instead of the calculated one: both parts, or none. */
  manualPrice: z.object({ price: z.number(), reason: z.string().max(400) }).strict().nullable().optional(),
}).strict();

/** The acceptance carries nothing: the quote is the path, the author the session. */
export const noBody = z.object({}).strict().optional();

/** Query string `limit` of the list: 20 when absent, otherwise an integer from 1 to 100. */
export const quotesLimitParam = z.union([
  z.undefined().transform(() => 20),
  z.string().transform(Number).pipe(z.number().int().min(1).max(100)),
]);

/** Query string `cursor` of the list: what a previous page gave, or nothing. */
export const quotesCursorParam = z.union([
  z.undefined().transform(() => null),
  z.string().transform((raw, context) => {
    const cursor = decodeQuoteCursor(raw);
    if (cursor === null) {
      context.addIssue({ code: 'custom', message: 'invalid cursor' });
      return z.NEVER;
    }
    return cursor;
  }),
]);
