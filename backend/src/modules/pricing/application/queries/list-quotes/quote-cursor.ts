import { QuoteCursor } from '../../ports/read-quote.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Opaque to clients: the date and identifier of the last quote of a page. */
export function encodeQuoteCursor(cursor: QuoteCursor): string {
  return Buffer.from(`${cursor.issuedAt}|${cursor.id}`, 'utf8').toString('base64url');
}

/** `null` for anything the system did not write. */
export function decodeQuoteCursor(raw: string): QuoteCursor | null {
  if (raw.length > 120 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  const [issuedAt, id, ...rest] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || issuedAt === undefined || id === undefined) return null;
  if (!ISO_MILLISECONDS.test(issuedAt) || Number.isNaN(Date.parse(issuedAt)) || !UUID.test(id)) return null;
  return { issuedAt, id };
}
