import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import { identityChangeOf } from '../../domain/agency-identity';
import { AgencyAlreadySubmitted, AgencyIdentityLocked, SubmissionIncomplete } from '../../domain/exceptions/agency.exceptions';
import { SuspensionReason } from '../../domain/value-objects/suspension-reason';
import { anAgency, withActiveSite, withActiveZone } from '../doubles/fakes';

const OWNER = UserId.of(uuid(1));
const T1 = new Date('2026-11-15T09:00:00.000Z');
const T2 = new Date('2026-11-16T09:00:00.000Z');
const FULL_IDENTITY = { legalName: 'Express Douala SARL', headquartersCity: 'Douala', headquartersAddress: 'Rue Joss, Akwa', primaryPhone: '677123456' };

/** A draft with the identity (minus `without`), an active delivery capability and an active site. */
function draft(without: readonly (keyof typeof FULL_IDENTITY)[] = []): Agency {
  const agency = anAgency('draft', 1);
  const kept = Object.fromEntries(Object.entries(FULL_IDENTITY).filter(([field]) => !without.some(name => name === field)));
  agency.completeIdentity(identityChangeOf(kept), OWNER, 1);
  withActiveZone(agency, 1, 'Douala', 'Akwa');
  withActiveSite(agency, 1, 'Agence Akwa');
  agency.enableCapability('delivery', OWNER, T1);
  agency.pullEvents();
  return agency;
}

function refusal(action: () => unknown): SubmissionIncomplete {
  try {
    action();
  } catch (error) {
    if (error instanceof SubmissionIncomplete) return error;
    throw error;
  }
  throw new assert.AssertionError({ message: 'The submission was not refused' });
}

test('submitting a complete draft records the date and the author, keeps the version and raises one event', () => {
  const agency = draft();
  const version = agency.snapshot().version;
  agency.submit(OWNER, T1);
  const state = agency.snapshot();
  assert.equal(state.status, 'submitted');
  assert.deepEqual([state.submission?.at, state.submission?.by.value], [T1, OWNER.value]);
  assert.equal(state.version, version);
  assert.deepEqual(agency.pullEvents(), [{ type: 'AgencySubmittedForVerification', agencyId: uuid(10), actorId: OWNER.value }]);
});

test('each missing identity field is refused and named, and the agency stays a draft without event', () => {
  const cases = [['legalName', 'legal_name'], ['headquartersCity', 'headquarters_city'], ['headquartersAddress', 'headquarters_address'], ['primaryPhone', 'primary_phone']] as const;
  for (const [field, code] of cases) {
    const agency = draft([field]);
    const error = refusal(() => agency.submit(OWNER, T1));
    assert.equal(error.kind, 'invalid');
    assert.deepEqual(error.missing, [code]);
    assert.equal(agency.snapshot().status, 'draft');
    assert.equal(agency.snapshot().submission, null);
    assert.deepEqual(agency.pullEvents(), []);
  }
});

test('a draft without capability, or whose only capability is suspended, is refused for its missing active capability', () => {
  const none = anAgency();
  none.completeIdentity(identityChangeOf(FULL_IDENTITY), OWNER, 1);
  withActiveSite(none, 1, 'Agence Akwa');
  assert.deepEqual(refusal(() => none.submit(OWNER, T1)).missing, ['active_capability']);

  const suspended = draft();
  suspended.suspendCapability('delivery', SuspensionReason.of('Inventaire annuel'), OWNER, T2);
  assert.deepEqual(refusal(() => suspended.submit(OWNER, T2)).missing, ['active_capability']);
});

test('every missing prerequisite is listed at once, in the order of the onboarding state', () => {
  const error = refusal(() => anAgency().submit(OWNER, T1));
  assert.deepEqual(error.missing, ['legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site']);
  assert.equal(error.extras?.code, 'SUBMISSION_INCOMPLETE');
});

test('the configuration of each active capability is checked again at submission', () => {
  const agency = draft();
  const state = agency.snapshot();
  // A snapshot that breaks the invariant of the capability (active delivery, no active zone), as a corrupted row would.
  const broken = Agency.reconstitute({ ...state, zones: state.zones.map(zone => ({ ...zone, retiredAt: T1 })) });
  assert.deepEqual(refusal(() => broken.submit(OWNER, T2)).missing, ['active_zone']);
});

test('a submitted agency cannot be submitted again: conflict, date and author unchanged, no event', () => {
  const agency = draft();
  agency.submit(OWNER, T1);
  agency.pullEvents();
  assert.throws(() => agency.submit(UserId.of(uuid(2)), T2), (error: unknown) => error instanceof AgencyAlreadySubmitted && error.kind === 'conflict' && error.extras?.code === 'AGENCY_ALREADY_SUBMITTED');
  assert.deepEqual([agency.snapshot().submission?.at, agency.snapshot().submission?.by.value], [T1, OWNER.value]);
  assert.deepEqual(agency.pullEvents(), []);
});

test('after submission the identity is locked while profile, zones, sites and capabilities stay editable', () => {
  const agency = draft();
  agency.submit(OWNER, T1);
  assert.throws(() => agency.completeIdentity(identityChangeOf({ legalName: 'Autre nom' }), OWNER, 1), AgencyIdentityLocked);
  withActiveZone(agency, 2, 'Yaoundé');
  withActiveSite(agency, 2, 'Dépôt Bonabéri');
  agency.enableCapability('storage', OWNER, T2);
  assert.equal(agency.snapshot().status, 'submitted');
});
