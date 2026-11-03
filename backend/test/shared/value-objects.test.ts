import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Email, InvalidEmail } from '../../src/shared/domain/vo/email';
import { InvalidIdentifier } from '../../src/shared/domain/vo/identifier';
import { InvalidOpaqueToken, OpaqueToken } from '../../src/shared/domain/vo/opaque-token';
import { InvalidTokenDigest, TokenDigest } from '../../src/shared/domain/vo/token-digest';
import { UserId } from '../../src/shared/domain/vo/user-id';

const ID = '00000000-0000-4000-8000-000000000001';
const SECRET = 'A'.repeat(43);

test('email is trimmed and lowercased', () => {
  assert.equal(Email.of('  Person@Example.COM ').value, 'person@example.com');
  assert.ok(Email.of('a@b').equals(Email.of('A@B')));
});

test('email without @ or longer than 254 characters is rejected', () => {
  assert.throws(() => Email.of(''), InvalidEmail);
  assert.throws(() => Email.of('person.example.com'), InvalidEmail);
  assert.throws(() => Email.of(`${'a'.repeat(250)}@b.co`), InvalidEmail);
  assert.equal(Email.of(`${'a'.repeat(249)}@b.co`).value.length, 254);
});

test('identifiers must be UUIDs and compare by value', () => {
  assert.throws(() => UserId.of('user-1'), InvalidIdentifier);
  assert.ok(UserId.of(ID).equals(UserId.of(ID)));
  assert.equal(UserId.of(ID).equals(UserId.of('00000000-0000-4000-8000-000000000002')), false);
});

test('token digest accepts only 64 lowercase hex characters', () => {
  assert.throws(() => TokenDigest.of('A'.repeat(64)), InvalidTokenDigest);
  assert.throws(() => TokenDigest.of('a'.repeat(63)), InvalidTokenDigest);
  assert.ok(TokenDigest.of('a'.repeat(64)).matches(TokenDigest.of('a'.repeat(64))));
  assert.equal(TokenDigest.of('a'.repeat(64)).matches(TokenDigest.of(`${'a'.repeat(63)}b`)), false);
});

test('opaque token is a UUID v4 and a 43-character base64url secret', () => {
  const token = OpaqueToken.parse(`${ID}.${SECRET}`);
  assert.equal(token.id, ID);
  assert.equal(token.secret, SECRET);
  assert.equal(OpaqueToken.compose(ID, SECRET).toString(), `${ID}.${SECRET}`);
  assert.throws(() => OpaqueToken.parse('invalid'), InvalidOpaqueToken);
  assert.throws(() => OpaqueToken.parse(`${ID}.${SECRET}x`), InvalidOpaqueToken);
  assert.throws(() => OpaqueToken.parse(`00000000-0000-1000-8000-000000000001.${SECRET}`), InvalidOpaqueToken);
});
