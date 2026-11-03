import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUsableSession, rotateSession, revokeSession, Session } from '../../src/modules/identity/domain/sessions';

const session: Session = { id: 'session-1', userId: 'user-1', tokenDigest: 'a'.repeat(64), expiresAt: 2000, revokedAt: null, version: 1 };
test('expired or revoked sessions cannot be used', () => {
  assert.equal(isUsableSession(session, 1999), true);
  assert.equal(isUsableSession(session, 2000), false);
  assert.equal(isUsableSession({ ...session, revokedAt: 1000 }, 1001), false);
});
test('refresh rotation changes the digest and rejects stale versions', () => {
  const rotated = rotateSession(session, 'a'.repeat(64), 'b'.repeat(64), 1, 1000, 3000);
  assert.equal(rotated.version, 2);
  assert.equal(rotated.tokenDigest, 'b'.repeat(64));
  assert.throws(() => rotateSession(rotated, 'a'.repeat(64), 'c'.repeat(64), 1, 1001, 3000));
  assert.throws(() => rotateSession(session, 'a'.repeat(64), 'a'.repeat(64), 1, 1000, 3000));
  assert.throws(() => rotateSession(session, 'a'.repeat(64), 'b'.repeat(64), 1, 2000, 3000));
});
test('revocation immediately makes a session unusable', () => {
  assert.equal(isUsableSession(revokeSession(session, 1000), 1000), false);
  assert.equal(revokeSession(revokeSession(session, 1000), 1500).revokedAt, 1000);
});
