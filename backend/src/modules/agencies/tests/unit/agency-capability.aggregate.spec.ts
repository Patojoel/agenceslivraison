import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { at, uuid } from '@shared/tests/doubles/fakes';
import { capabilityTypeOf } from '../../domain/capability';
import {
  CapabilityAlreadyActive, CapabilityNotActive, CapabilityPrerequisiteMissing, InvalidAgencyField,
} from '../../domain/exceptions/agency.exceptions';
import { SuspensionReason } from '../../domain/value-objects/suspension-reason';
import { anAgency, withActiveSite, withActiveZone } from '../doubles/fakes';

const ACTOR = UserId.of(uuid(2));
const SECOND = UserId.of(uuid(3));
const T1 = new Date('2026-01-10T00:00:00.000Z');
const T2 = new Date('2026-01-12T00:00:00.000Z');
const reason = (text = 'Inventaire annuel') => SuspensionReason.of(text);

const delivering = () => withActiveZone(anAgency(), 1, 'Douala', 'Akwa');
const storing = () => withActiveSite(anAgency(), 1, 'Dépôt Bonabéri');

function missingOf(action: () => unknown): readonly string[] {
  try {
    action();
  } catch (error) {
    if (error instanceof CapabilityPrerequisiteMissing) {
      assert.equal(error.kind, 'invalid');
      return error.missing;
    }
    throw error;
  }
  throw new Error('expected a CapabilityPrerequisiteMissing');
}

test('a new agency has no capability and is not hybrid', () => {
  const agency = anAgency();
  assert.deepEqual(agency.capabilityStates(), []);
  assert.equal(agency.isHybrid(), false);
  assert.equal(agency.acceptsNewRequests('delivery'), false);
});

test('delivery is enabled once a zone is served, and records AgencyCapabilityEnabled', () => {
  const agency = delivering();
  agency.pullEvents();
  const state = agency.enableCapability('delivery', ACTOR, T1);
  assert.deepEqual(state, { type: 'delivery', state: 'active', since: T1, reason: null, acceptsNewRequests: true });
  assert.deepEqual(agency.pullEvents(), [{ type: 'AgencyCapabilityEnabled', agencyId: uuid(10), actorId: uuid(2), capability: 'delivery' }]);
  assert.equal(agency.snapshot().version, 1, 'the agency version is untouched');
});

test('storage is enabled once a site is active', () => {
  assert.equal(storing().enableCapability('storage', ACTOR, T1).state, 'active');
});

test('without its minimal configuration a capability is refused and the missing element is named', () => {
  const agency = anAgency();
  agency.pullEvents();
  assert.deepEqual(missingOf(() => agency.enableCapability('delivery', ACTOR, T1)), ['active_zone']);
  assert.deepEqual(missingOf(() => agency.enableCapability('storage', ACTOR, T1)), ['active_site']);
  assert.deepEqual([agency.capabilityStates(), agency.pullEvents()], [[], []]);
});

test('a zone is not enough for storage and a site is not enough for delivery', () => {
  assert.deepEqual(missingOf(() => delivering().enableCapability('storage', ACTOR, T1)), ['active_site']);
  assert.deepEqual(missingOf(() => storing().enableCapability('delivery', ACTOR, T1)), ['active_zone']);
});

test('retired zones and deactivated sites do not count', () => {
  const noZone = delivering();
  noZone.retireZone(at(noZone.snapshot().zones, 0).id, ACTOR, T1);
  assert.deepEqual(missingOf(() => noZone.enableCapability('delivery', ACTOR, T1)), ['active_zone']);
  const noSite = storing();
  noSite.deactivateSite(at(noSite.snapshot().sites, 0).id, ACTOR, T1);
  assert.deepEqual(missingOf(() => noSite.enableCapability('storage', ACTOR, T1)), ['active_site']);
});

test('both capabilities active make the agency hybrid', () => {
  const agency = withActiveSite(delivering(), 1, 'Dépôt Bonabéri');
  agency.enableCapability('delivery', ACTOR, T1);
  assert.equal(agency.isHybrid(), false);
  agency.enableCapability('storage', ACTOR, T1);
  assert.equal(agency.isHybrid(), true);
});

test('enabling an active capability is a conflict with no second event', () => {
  const agency = delivering();
  agency.enableCapability('delivery', ACTOR, T1);
  agency.pullEvents();
  assert.throws(() => agency.enableCapability('delivery', SECOND, T2), CapabilityAlreadyActive);
  assert.deepEqual(agency.pullEvents(), []);
  assert.equal(at(agency.capabilityStates(), 0).since, T1);
});

test('suspending records a reason and stops new requests, keeping the capability visible', () => {
  const agency = delivering();
  agency.enableCapability('delivery', ACTOR, T1);
  agency.pullEvents();
  const state = agency.suspendCapability('delivery', reason(), SECOND, T2);
  assert.deepEqual(state, { type: 'delivery', state: 'suspended', since: T2, reason: 'Inventaire annuel', acceptsNewRequests: false });
  assert.equal(agency.acceptsNewRequests('delivery'), false);
  assert.deepEqual(agency.pullEvents(), [{ type: 'AgencyCapabilitySuspended', agencyId: uuid(10), actorId: uuid(3), capability: 'delivery' }]);
});

test('the suspension reason keeps 3 to 500 characters', () => {
  assert.throws(() => SuspensionReason.of(''), InvalidAgencyField);
  assert.throws(() => SuspensionReason.of('ok'), InvalidAgencyField);
  assert.equal(SuspensionReason.of('abc').value, 'abc');
  assert.equal(SuspensionReason.of('x'.repeat(500)).value.length, 500);
  assert.throws(() => SuspensionReason.of('x'.repeat(501)), InvalidAgencyField);
  assert.throws(() => SuspensionReason.of('   ab   '), InvalidAgencyField);
  assert.throws(() => SuspensionReason.of('Motif\u0000'), InvalidAgencyField);
});

test('suspending a capability that is suspended or was never enabled is a conflict with no event', () => {
  const agency = delivering();
  assert.throws(() => agency.suspendCapability('delivery', reason(), ACTOR, T1), CapabilityNotActive);
  agency.enableCapability('delivery', ACTOR, T1);
  agency.suspendCapability('delivery', reason(), ACTOR, T2);
  agency.pullEvents();
  assert.throws(() => agency.suspendCapability('delivery', reason('Autre motif'), ACTOR, T2), CapabilityNotActive);
  assert.deepEqual(agency.pullEvents(), []);
  assert.equal(at(agency.capabilityStates(), 0).reason, 'Inventaire annuel');
});

test('suspending one capability of a hybrid agency leaves the other active', () => {
  const agency = withActiveSite(delivering(), 1, 'Dépôt Bonabéri');
  agency.enableCapability('delivery', ACTOR, T1);
  agency.enableCapability('storage', ACTOR, T1);
  agency.suspendCapability('storage', reason(), ACTOR, T2);
  assert.deepEqual([agency.isHybrid(), agency.acceptsNewRequests('delivery'), agency.acceptsNewRequests('storage')], [false, true, false]);
});

test('suspending the last active capability is allowed and does not change the status', () => {
  const agency = withActiveZone(anAgency('submitted', 4), 1, 'Douala', 'Akwa');
  agency.enableCapability('delivery', ACTOR, T1);
  agency.suspendCapability('delivery', reason(), ACTOR, T2);
  assert.deepEqual([agency.snapshot().status, agency.snapshot().version, at(agency.capabilityStates(), 0).state], ['submitted', 4, 'suspended']);
});

test('a suspended capability is enabled again by the same action, and its history stays', () => {
  const agency = delivering();
  agency.enableCapability('delivery', ACTOR, T1);
  agency.suspendCapability('delivery', reason(), ACTOR, T2);
  const back = agency.enableCapability('delivery', SECOND, new Date('2026-01-20T00:00:00.000Z'));
  assert.deepEqual([back.state, back.reason], ['active', null]);
  assert.deepEqual(agency.snapshot().capabilityTransitions.map(item => [item.type, item.kind, item.sequence, item.reason?.value ?? null, item.actorId.value]), [
    ['delivery', 'activated', 1, null, uuid(2)],
    ['delivery', 'suspended', 2, 'Inventaire annuel', uuid(2)],
    ['delivery', 'activated', 3, null, uuid(3)],
  ]);
});

test('re-enabling checks the minimal configuration again', () => {
  const agency = delivering();
  agency.enableCapability('delivery', ACTOR, T1);
  agency.suspendCapability('delivery', reason(), ACTOR, T2);
  agency.retireZone(at(agency.snapshot().zones, 0).id, ACTOR, T2);
  assert.throws(() => agency.enableCapability('delivery', ACTOR, T2), CapabilityPrerequisiteMissing);
  assert.equal(at(agency.capabilityStates(), 0).state, 'suspended');
});

test('capabilities can be managed on a submitted agency', () => {
  const agency = withActiveZone(anAgency('submitted', 2), 1, 'Douala', 'Akwa');
  assert.equal(agency.enableCapability('delivery', ACTOR, T1).state, 'active');
});

test('only delivery and storage exist', () => {
  assert.equal(capabilityTypeOf('delivery'), 'delivery');
  assert.equal(capabilityTypeOf('storage'), 'storage');
  for (const unknown of ['transport aérien', '', 'DELIVERY', 'hybrid']) assert.throws(() => capabilityTypeOf(unknown), InvalidAgencyField, unknown);
});
