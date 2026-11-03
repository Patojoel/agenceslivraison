import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Email, InvalidEmail } from '../../src/shared/domain/vo/email';
import { RegisterUserHandler } from '../../src/modules/identity/application/command/register-user/register-user.handler';
import { EmailAlreadyRegistered, InvalidPassword } from '../../src/modules/identity/domain/exceptions/identity.exceptions';
import { RecordingEventPublisher, SequentialIds, uuid } from '../support/fakes';
import { FakePasswordHasher, InMemoryUserRepository } from './fakes';

function setup() {
  const users = new InMemoryUserRepository();
  const events = new RecordingEventPublisher();
  const handler = new RegisterUserHandler(users, new FakePasswordHasher(), new SequentialIds(), events);
  return { users, events, handler };
}

const valid = { email: ' Person@Example.com ', password: 'correct horse battery staple', accountType: 'individual' as const };

test('registration stores a normalized email and a password hash, never the password', async () => {
  const { users, events, handler } = setup();
  assert.deepEqual(await handler.handle(valid), { id: uuid(1000), accountType: 'individual' });
  const saved = await users.findByEmail(Email.of('person@example.com'));
  assert.equal(saved?.passwordHash, `hashed:${valid.password}`);
  assert.deepEqual(events.published, [{ type: 'UserRegistered', userId: uuid(1000) }]);
});

test('an already registered email is refused after normalization', async () => {
  const { users, events, handler } = setup();
  await handler.handle(valid);
  await assert.rejects(handler.handle({ ...valid, email: 'PERSON@example.com' }), EmailAlreadyRegistered);
  assert.equal(users.count(), 1);
  assert.equal(events.published.length, 1);
});

test('password must be 12 to 128 characters and at most 256 bytes', async () => {
  const { users, handler } = setup();
  await assert.rejects(handler.handle({ ...valid, password: 'a'.repeat(11) }), InvalidPassword);
  await assert.rejects(handler.handle({ ...valid, password: 'a'.repeat(129) }), InvalidPassword);
  await assert.rejects(handler.handle({ ...valid, password: '€'.repeat(86) }), InvalidPassword);
  await handler.handle({ ...valid, email: 'min@example.com', password: 'a'.repeat(12) });
  await handler.handle({ ...valid, email: 'max@example.com', password: 'a'.repeat(128) });
  await handler.handle({ ...valid, email: 'bytes@example.com', password: 'é'.repeat(128) });
  assert.equal(users.count(), 3);
});

test('an invalid email is refused', async () => {
  await assert.rejects(setup().handler.handle({ ...valid, email: 'not-an-email' }), InvalidEmail);
});
