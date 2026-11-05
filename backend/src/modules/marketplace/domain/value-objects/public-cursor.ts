import { InvalidPublicSearch } from '../exceptions/marketplace.exceptions';

export interface PublicCursorPosition {
  readonly nameKey: string;
  readonly slug: string;
}

const MAX_LENGTH = 4096;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UNSAFE = /[\p{Cc}\p{Cf}]/u;

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(raw: string): string {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (raw.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

/**
 * Where the next page starts: the sort key of the last row served (name in comparison form, then slug), and the search that
 * produced it. It is opaque to clients (base64url) but not secret: it holds nothing that a result does not already show.
 * A cursor used with another search, or altered into something that is not one, is refused; one altered into another
 * valid position only moves the start of the page, which any visitor could ask for anyway.
 */
export class PublicCursor {
  static encode(search: string, position: PublicCursorPosition): string {
    return encodeBase64Url(JSON.stringify([search, position.nameKey, position.slug]));
  }

  static decode(raw: string, search: string): PublicCursorPosition {
    if (raw.length > MAX_LENGTH || !BASE64URL.test(raw)) throw new InvalidPublicSearch();
    let parts: unknown;
    try {
      const text = decodeBase64Url(raw);
      if (encodeBase64Url(text) !== raw) throw new InvalidPublicSearch();
      parts = JSON.parse(text);
    } catch {
      throw new InvalidPublicSearch();
    }
    if (!Array.isArray(parts) || parts.length !== 3) throw new InvalidPublicSearch();
    const [boundSearch, nameKey, slug] = parts as unknown[];
    if (typeof boundSearch !== 'string' || typeof nameKey !== 'string' || typeof slug !== 'string') throw new InvalidPublicSearch();
    if (boundSearch !== search) throw new InvalidPublicSearch();
    if (nameKey.length < 1 || nameKey.length > 240 || UNSAFE.test(nameKey)) throw new InvalidPublicSearch();
    if (slug.length < 3 || slug.length > 80 || !SLUG.test(slug)) throw new InvalidPublicSearch();
    return { nameKey, slug };
  }
}
