import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableError } from '@shared/application/errors/service-unavailable.error';
import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { LoginHandler } from '../../application/commands/login/login.handler';
import { InvalidCredentials } from '../../domain/exceptions/identity.exceptions';
import { User } from '../../domain/user';
import { DAY, DeterministicTokenSecrets, FixedClock, RecordingEventPublisher, SequentialIds, T0, tokenParts, uuid } from '@shared/tests/doubles/fakes';
import { FakeAccessTokens, FakePasswordHasher, InMemorySessionRepository, InMemoryUserRepository } from '../doubles/fakes';

async function setup() {
  const users = new InMemoryUserRepository();
  await users.add(User.reconstitute({ id: UserId.of(uuid(1)), email: Email.of('person@example.com'), passwordHash: 'hashed:correct horse battery staple', accountType: 'merchant' }));
  const sessions = new InMemorySessionRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeAccessTokens();
  const secrets = new DeterministicTokenSecrets();
  const events = new RecordingEventPublisher();
  const handler = new LoginHandler(users, sessions, hasher, tokens, secrets, new SequentialIds(), new FixedClock(), events);
  return { sessions, hasher, tokens, secrets, events, handler };
}

test('valid credentials open a 30-day session and return both tokens', async () => {
  const { sessions, secrets, events, handler } = await setup();
  const result = await handler.handle({ email: 'person@example.com', password: 'correct horse battery staple' });
  const [sessionId, secret] = tokenParts(result.refreshToken);
  assert.equal(sessionId, uuid(1000));
  assert.equal(result.accessToken, `access:${uuid(1)}:${uuid(1000)}`);
  assert.equal(result.expiresIn, 900);
  const stored = sessions.stored(sessionId);
  assert.equal(stored?.tokenDigest.value, secrets.digest(secret).value);
  assert.notEqual(stored?.tokenDigest.value, secret);
  assert.deepEqual(stored?.expiresAt, new Date(T0.getTime() + 30 * DAY));
  assert.deepEqual(events.published, [{ type: 'SessionOpened', userId: uuid(1), sessionId: uuid(1000) }]);
});

test('a wrong password and an unknown email fail the same way, after a password verification', async () => {
  const { sessions, hasher, events, handler } = await setup();
  await assert.rejects(handler.handle({ email: 'person@example.com', password: 'incorrect' }), InvalidCredentials);
  await assert.rejects(handler.handle({ email: 'unknown@example.com', password: 'incorrect' }), InvalidCredentials);
  assert.deepEqual(hasher.verifiedHashes, ['hashed:correct horse battery staple', null]);
  assert.equal(sessions.count(), 0);
  assert.deepEqual(events.published, []);
});

test('without a signing key, login is unavailable before credentials are checked', async () => {
  const { hasher, tokens, handler } = await setup();
  tokens.available = false;
  await assert.rejects(handler.handle({ email: 'person@example.com', password: 'incorrect' }), ServiceUnavailableError);
  assert.deepEqual(hasher.verifiedHashes, []);
});
