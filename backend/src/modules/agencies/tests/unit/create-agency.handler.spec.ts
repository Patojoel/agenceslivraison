import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateAgencyHandler } from '../../application/commands/create-agency/create-agency.handler';
import { IdempotencyKeyReused, InvalidTradeName } from '../../domain/exceptions/agency.exceptions';
import { FixedClock, InMemoryIdempotencyKeys, RecordingEventPublisher, SequentialIds, T0, uuid } from '@shared/tests/doubles/fakes';
import { InMemoryAgencyRepository, InMemoryAgencyTeamRepository } from '../doubles/fakes';

const AWA = uuid(1);
const IBRAHIM = uuid(2);

function setup() {
  const agencies = new InMemoryAgencyRepository();
  const teams = new InMemoryAgencyTeamRepository();
  const idempotency = new InMemoryIdempotencyKeys();
  const events = new RecordingEventPublisher();
  return { agencies, teams, events, handler: new CreateAgencyHandler(agencies, teams, idempotency, new SequentialIds(), new FixedClock(), events) };
}

test('creating an agency stores a draft, makes the creator its owner and publishes AgencyRegistered', async () => {
  const { agencies, teams, events, handler } = setup();
  const result = await handler.handle({ actorId: AWA, tradeName: '  Express Douala ', idempotencyKey: null });
  assert.deepEqual(result, { agencyId: uuid(1000), tradeName: 'Express Douala', status: 'draft', role: 'owner' });
  const stored = agencies.stored(result.agencyId);
  assert.equal(stored?.status, 'draft');
  assert.equal(stored?.createdAt, T0);
  const [owner] = teams.memberships(result.agencyId);
  assert.deepEqual([owner?.userId.value, owner?.role, owner?.active], [AWA, 'owner', true]);
  assert.deepEqual(events.published, [{ type: 'AgencyRegistered', agencyId: result.agencyId, actorId: AWA }]);
});

test('an owner can create a second agency and keeps the first one untouched', async () => {
  const { agencies, teams, handler } = setup();
  const first = await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: null });
  const second = await handler.handle({ actorId: AWA, tradeName: 'Express Kribi', idempotencyKey: null });
  assert.notEqual(first.agencyId, second.agencyId);
  assert.equal(agencies.count(), 2);
  assert.equal(teams.memberships(first.agencyId).length, 1);
  assert.equal(teams.memberships(second.agencyId).length, 1);
});

test('without an idempotency key, the same request creates two drafts', async () => {
  const { agencies, handler } = setup();
  await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: null });
  await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: null });
  assert.equal(agencies.count(), 2);
});

test('replaying a request with the same key returns the same agency without another write or event', async () => {
  const { agencies, events, handler } = setup();
  const first = await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: 'cle-00001' });
  const replay = await handler.handle({ actorId: AWA, tradeName: ' Express Douala ', idempotencyKey: 'cle-00001' });
  assert.deepEqual(replay, first);
  assert.equal(agencies.count(), 1);
  assert.equal(events.published.length, 1);
});

test('a key reused for another content is a conflict and writes nothing', async () => {
  const { agencies, events, handler } = setup();
  await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: 'cle-00003' });
  await assert.rejects(handler.handle({ actorId: AWA, tradeName: 'Express Kribi', idempotencyKey: 'cle-00003' }), IdempotencyKeyReused);
  assert.equal(agencies.count(), 1);
  assert.equal(events.published.length, 1);
});

test('an idempotency key belongs to the person who sent it', async () => {
  const { agencies, handler } = setup();
  const awa = await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: 'cle-00001' });
  const ibrahim = await handler.handle({ actorId: IBRAHIM, tradeName: 'Express Douala', idempotencyKey: 'cle-00001' });
  assert.notEqual(awa.agencyId, ibrahim.agencyId);
  assert.equal(agencies.count(), 2);
});

test('an invalid trade name creates nothing and does not consume the key', async () => {
  const { agencies, events, handler } = setup();
  await assert.rejects(handler.handle({ actorId: AWA, tradeName: ' A ', idempotencyKey: 'cle-00009' }), InvalidTradeName);
  assert.equal(agencies.count(), 0);
  assert.deepEqual(events.published, []);
  const retry = await handler.handle({ actorId: AWA, tradeName: 'Express Douala', idempotencyKey: 'cle-00009' });
  assert.equal(retry.tradeName, 'Express Douala');
});
