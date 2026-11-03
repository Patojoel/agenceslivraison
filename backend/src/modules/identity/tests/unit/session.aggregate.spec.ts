import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { InvalidSession } from '../../domain/exceptions/identity.exceptions';
import { Session, SESSION_LIFETIME_MS } from '../../domain/session';
import { SessionId } from '../../domain/value-objects/session-id';
import { T0, uuid } from '@shared/tests/doubles/fakes';

const A = TokenDigest.of('a'.repeat(64));
const B = TokenDigest.of('b'.repeat(64));
const C = TokenDigest.of('c'.repeat(64));
const at = (milliseconds: number) => new Date(T0.getTime() + milliseconds);
const open = () => Session.open(SessionId.of(uuid(2)), UserId.of(uuid(1)), A, T0);

test('an opened session lasts 30 days and records SessionOpened', () => {
  const session = open();
  assert.deepEqual(session.pullEvents(), [{ type: 'SessionOpened', userId: uuid(1), sessionId: uuid(2) }]);
  assert.equal(session.snapshot().version, 1);
  assert.equal(session.isUsable(at(SESSION_LIFETIME_MS - 1)), true);
  assert.equal(session.isUsable(at(SESSION_LIFETIME_MS)), false);
});

test('rotation replaces the digest, extends expiry and bumps the version', () => {
  const session = open();
  session.pullEvents();
  session.rotate(A, B, at(1000));
  assert.equal(session.snapshot().tokenDigest, B);
  assert.equal(session.snapshot().version, 2);
  assert.deepEqual(session.snapshot().expiresAt, at(1000 + SESSION_LIFETIME_MS));
  assert.deepEqual(session.pullEvents(), [{ type: 'SessionRefreshed', userId: uuid(1), sessionId: uuid(2) }]);
});

test('rotation refuses a stale digest, an unchanged digest, an expired or a revoked session', () => {
  const rotated = open();
  rotated.rotate(A, B, at(1000));
  assert.throws(() => rotated.rotate(A, C, at(2000)), InvalidSession);
  assert.throws(() => open().rotate(A, A, at(1000)), InvalidSession);
  assert.throws(() => open().rotate(A, B, at(SESSION_LIFETIME_MS)), InvalidSession);
  const revoked = open();
  revoked.revoke(A, at(1000));
  assert.throws(() => revoked.rotate(A, B, at(1001)), InvalidSession);
});

test('revocation makes the session unusable and cannot happen twice', () => {
  const session = open();
  session.pullEvents();
  session.revoke(A, at(1000));
  assert.equal(session.isUsable(at(1000)), false);
  assert.deepEqual(session.snapshot().revokedAt, at(1000));
  assert.deepEqual(session.pullEvents(), [{ type: 'SessionRevoked', userId: uuid(1), sessionId: uuid(2) }]);
  assert.throws(() => session.revoke(A, at(1500)), InvalidSession);
  assert.deepEqual(session.snapshot().revokedAt, at(1000));
});

test('revocation requires the current digest but not an unexpired session', () => {
  assert.throws(() => open().revoke(B, at(1000)), InvalidSession);
  const expired = open();
  expired.revoke(A, at(SESSION_LIFETIME_MS + 1));
  assert.notEqual(expired.snapshot().revokedAt, null);
});
