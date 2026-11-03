import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableError } from '@shared/application/errors/service-unavailable.error';
import { UserId } from '@shared/domain/value-objects/user-id';
import { LogoutHandler } from '../../application/commands/logout/logout.handler';
import { RefreshSessionHandler } from '../../application/commands/refresh-session/refresh-session.handler';
import { InvalidSession } from '../../domain/exceptions/identity.exceptions';
import { Session, SESSION_LIFETIME_MS } from '../../domain/session';
import { SessionId } from '../../domain/value-objects/session-id';
import { DeterministicTokenSecrets, FixedClock, RecordingEventPublisher, T0, uuid } from '@shared/tests/doubles/fakes';
import { FakeAccessTokens, InMemorySessionRepository } from '../doubles/fakes';

const ORIGINAL_SECRET = 'o'.repeat(43);
const originalToken = `${uuid(2)}.${ORIGINAL_SECRET}`;

async function setup() {
  const sessions = new InMemorySessionRepository();
  const secrets = new DeterministicTokenSecrets();
  await sessions.add(Session.open(SessionId.of(uuid(2)), UserId.of(uuid(1)), secrets.digest(ORIGINAL_SECRET), T0));
  const clock = new FixedClock();
  const tokens = new FakeAccessTokens();
  const events = new RecordingEventPublisher();
  return {
    sessions, clock, tokens, events,
    refresh: new RefreshSessionHandler(sessions, tokens, secrets, clock, events),
    logout: new LogoutHandler(sessions, secrets, clock, events),
  };
}

test('refresh rotates the refresh token and issues a new access token', async () => {
  const { sessions, clock, events, refresh } = await setup();
  clock.advance(1000);
  const result = await refresh.handle({ refreshToken: originalToken });
  assert.equal(result.accessToken, `access:${uuid(1)}:${uuid(2)}`);
  assert.equal(result.expiresIn, 900);
  assert.notEqual(result.refreshToken, originalToken);
  assert.equal(result.refreshToken.split('.')[0], uuid(2));
  assert.equal(sessions.stored(uuid(2))?.version, 2);
  assert.deepEqual(events.types(), ['SessionRefreshed']);
});

test('a refresh token works only once', async () => {
  const { refresh } = await setup();
  const next = await refresh.handle({ refreshToken: originalToken });
  await assert.rejects(refresh.handle({ refreshToken: originalToken }), InvalidSession);
  await refresh.handle({ refreshToken: next.refreshToken });
});

test('refresh fails for an unknown, expired or logged out session', async () => {
  const { logout, refresh } = await setup();
  await assert.rejects(refresh.handle({ refreshToken: `${uuid(3)}.${ORIGINAL_SECRET}` }), InvalidSession);
  await logout.handle({ refreshToken: originalToken });
  await assert.rejects(refresh.handle({ refreshToken: originalToken }), InvalidSession);
  const expiring = await setup();
  expiring.clock.advance(SESSION_LIFETIME_MS);
  await assert.rejects(expiring.refresh.handle({ refreshToken: originalToken }), InvalidSession);
});

test('without a signing key, refresh is unavailable and the session is untouched', async () => {
  const { sessions, tokens, refresh } = await setup();
  tokens.available = false;
  await assert.rejects(refresh.handle({ refreshToken: originalToken }), ServiceUnavailableError);
  assert.equal(sessions.stored(uuid(2))?.version, 1);
});

test('logout revokes the session once, with the current refresh token only', async () => {
  const { sessions, events, logout, refresh } = await setup();
  const next = await refresh.handle({ refreshToken: originalToken });
  await assert.rejects(logout.handle({ refreshToken: originalToken }), InvalidSession);
  assert.deepEqual(await logout.handle({ refreshToken: next.refreshToken }), { success: true });
  assert.notEqual(sessions.stored(uuid(2))?.revokedAt, null);
  await assert.rejects(logout.handle({ refreshToken: next.refreshToken }), InvalidSession);
  assert.deepEqual(events.types(), ['SessionRefreshed', 'SessionRevoked']);
});
