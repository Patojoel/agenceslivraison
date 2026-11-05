import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PublicCursor } from '../../domain/value-objects/public-cursor';

const SEARCH = '["express","douala",null,["delivery"]]';
const POSITION = { nameKey: 'express douala', slug: 'express-douala' };
const refused = (raw: string, search = SEARCH): void => assert.throws(() => PublicCursor.decode(raw, search), { message: 'Invalid search parameters' });
const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64url');

test('a cursor gives back the position and the search it was made for', () => {
  assert.deepEqual(PublicCursor.decode(PublicCursor.encode(SEARCH, POSITION), SEARCH), POSITION);
});

test('a name in another script survives the round trip', () => {
  const position = { nameKey: 'ёжик доставка', slug: 'express-douala' };
  assert.deepEqual(PublicCursor.decode(PublicCursor.encode(SEARCH, position), SEARCH), position);
});

test('a cursor is URL-safe: no padding, no plus, no slash', () => {
  assert.match(PublicCursor.encode(SEARCH, POSITION), /^[A-Za-z0-9_-]+$/);
});

test('a cursor made for another search is refused', () => {
  refused(PublicCursor.encode(SEARCH, POSITION), '["express","yaounde",null,["delivery"]]');
});

test('what is not a cursor is refused', () => {
  const good = PublicCursor.encode(SEARCH, POSITION);
  refused('');
  refused('not a cursor');
  refused(`${good}=`);
  refused(`${good}!`);
  refused(`${good.slice(0, -3)}`);
  refused(good.replace(/.$/, good.endsWith('A') ? 'B' : 'A'));
  refused('a'.repeat(5000));
  refused(b64('plain text'));
  refused(b64('{"a":1}'));
  refused(b64(JSON.stringify([SEARCH, 'x'])));
  refused(b64(JSON.stringify([SEARCH, 1, 'express-douala'])));
  refused(b64(JSON.stringify([SEARCH, 'name', 'Bad Slug'])));
  refused(b64(JSON.stringify([SEARCH, 'name', '../etc'])));
  refused(b64(JSON.stringify([SEARCH, 'na\u0000me', 'express-douala'])));
  refused(b64(JSON.stringify([SEARCH, '', 'express-douala'])));
  refused(Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url'));
});
