import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { at, T0, uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import { AgencyTeam } from '../../domain/agency-team';
import { InvalidTradeName } from '../../domain/exceptions/agency.exceptions';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { MembershipId } from '../../domain/value-objects/membership-id';
import { TradeName } from '../../domain/value-objects/trade-name';

const CREATOR = UserId.of(uuid(1));
const draft = (name: string) => Agency.draft({ id: AgencyId.of(uuid(10)), tradeName: TradeName.of(name), createdBy: CREATOR }, T0);

test('a new agency is a draft at version 1 that keeps its trade name and creator', () => {
  const snapshot = draft('Express Douala').snapshot();
  assert.equal(snapshot.status, 'draft');
  assert.equal(snapshot.tradeName.value, 'Express Douala');
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.createdBy.value, CREATOR.value);
  assert.equal(snapshot.createdAt, T0);
});

test('creating an agency records AgencyRegistered once', () => {
  const agency = draft('Express Douala');
  assert.deepEqual(agency.pullEvents(), [{ type: 'AgencyRegistered', agencyId: uuid(10), actorId: uuid(1) }]);
  assert.deepEqual(agency.pullEvents(), []);
});

test('the trade name loses its edge spaces and keeps 2 to 120 characters', () => {
  assert.equal(TradeName.of('   Express Douala  ').value, 'Express Douala');
  assert.equal(TradeName.of('QX').value, 'QX');
  assert.equal(TradeName.of('x'.repeat(120)).value.length, 120);
  for (const refused of ['', '   ', 'A', ' A ', 'x'.repeat(121)]) {
    assert.throws(() => TradeName.of(refused), InvalidTradeName, `"${refused}"`);
  }
  assert.equal(TradeName.of(` ${'x'.repeat(120)} `).value.length, 120);
});

test('founding a team makes the creator its single active owner', () => {
  const team = AgencyTeam.found(AgencyId.of(uuid(10)), MembershipId.of(uuid(21)), CREATOR);
  const memberships = team.snapshot();
  assert.equal(memberships.length, 1);
  const owner = at(memberships, 0);
  assert.deepEqual([owner.id.value, owner.userId.value, owner.role, owner.active], [uuid(21), uuid(1), 'owner', true]);
  assert.equal(team.agencyId.value, uuid(10));
});

test('the trade name length counts characters, not UTF-16 units', () => {
  assert.throws(() => TradeName.of('😀'), InvalidTradeName);
  assert.equal(TradeName.of('😀😀').value, '😀😀');
  assert.equal(TradeName.of('😀'.repeat(120)).value.length, 240);
  assert.throws(() => TradeName.of('😀'.repeat(121)), InvalidTradeName);
});
