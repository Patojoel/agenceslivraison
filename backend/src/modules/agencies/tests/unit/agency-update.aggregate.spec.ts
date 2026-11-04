import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import { identityChangeOf, profileChangeOf } from '../../domain/agency-identity';
import { AgencyIdentityLocked, InvalidAgencyField, StaleAgencyVersion } from '../../domain/exceptions/agency.exceptions';
import { LegalName } from '../../domain/value-objects/legal-name';
import { PrimaryPhone } from '../../domain/value-objects/primary-phone';
import { anAgency } from '../doubles/fakes';

const ACTOR = UserId.of(uuid(2));

const agency = anAgency;

const complete = (target: Agency, raw: Parameters<typeof identityChangeOf>[0], version: number) => target.completeIdentity(identityChangeOf(raw), ACTOR, version);

test('completing the identity of a draft stores normalized values, raises the version by one and says which fields changed', () => {
  const target = agency('draft', 1);
  complete(target, { legalName: ' Express  Douala SARL ', headquartersCity: 'Douala', headquartersAddress: 'Rue Joss, face pharmacie', primaryPhone: '6 77 12 34 56' }, 1);
  const { identity, version, status } = target.snapshot();
  assert.deepEqual([identity.legalName?.value, identity.headquartersCity?.value, identity.headquartersAddress?.value, identity.primaryPhone?.value], ['Express Douala SARL', 'Douala', 'Rue Joss, face pharmacie', '+237677123456']);
  assert.deepEqual([version, status], [2, 'draft']);
  assert.deepEqual(target.pullEvents(), [{ type: 'AgencyIdentityUpdated', agencyId: uuid(10), actorId: uuid(2), fields: ['legalName', 'headquartersCity', 'headquartersAddress', 'primaryPhone'] }]);
});

test('an update is partial: fields that are not sent stay as they were', () => {
  const target = agency();
  complete(target, { legalName: 'Express Douala SARL', primaryPhone: '6 77 12 34 56', niu: 'M012345678901A' }, 1);
  complete(target, { primaryPhone: '6 99 00 11 22' }, 2);
  const { identity, version } = target.snapshot();
  assert.deepEqual([identity.legalName?.value, identity.primaryPhone?.value, identity.niu?.value, version], ['Express Douala SARL', '+237699001122', 'M012345678901A', 3]);
});

test('optional fields can be cleared, by null or by a blank text', () => {
  const target = agency();
  complete(target, { contactEmail: 'Contact@Express.cm', rccm: 'RC/DLA/2020/B/1234', niu: 'M012345678901A' }, 1);
  assert.equal(target.snapshot().identity.contactEmail?.value, 'contact@express.cm');
  complete(target, { contactEmail: null, rccm: '   ', niu: null }, 2);
  const { identity, version } = target.snapshot();
  assert.deepEqual([identity.contactEmail, identity.rccm, identity.niu, version], [null, null, null, 3]);
});

test('the four fields required for submission cannot be cleared', () => {
  for (const raw of [{ legalName: null }, { headquartersCity: null }, { headquartersAddress: null }, { primaryPhone: null }]) {
    assert.throws(() => identityChangeOf(raw), InvalidAgencyField, JSON.stringify(raw));
  }
});

test('sending the values already stored changes nothing: same version, no event', () => {
  const target = agency();
  complete(target, { legalName: 'Express Douala SARL', contactEmail: 'a@b.cm' }, 1);
  target.pullEvents();
  complete(target, { legalName: '  Express   Douala SARL', contactEmail: 'A@B.cm' }, 2);
  complete(target, {}, 2);
  assert.equal(target.snapshot().version, 2);
  assert.deepEqual(target.pullEvents(), []);
});

test('only the fields that really changed are reported', () => {
  const target = agency();
  complete(target, { legalName: 'Express Douala SARL', headquartersCity: 'Douala' }, 1);
  target.pullEvents();
  complete(target, { legalName: 'Express Douala SARL', headquartersCity: 'Edéa', rccm: 'RC/DLA/2020' }, 2);
  assert.deepEqual(target.pullEvents(), [{ type: 'AgencyIdentityUpdated', agencyId: uuid(10), actorId: uuid(2), fields: ['headquartersCity', 'rccm'] }]);
});

test('the identity of a submitted agency is locked, whatever the version', () => {
  const target = agency('submitted', 4);
  assert.throws(() => complete(target, { legalName: 'Express Cameroun SARL' }, 4), AgencyIdentityLocked);
  assert.throws(() => complete(target, {}, 4), AgencyIdentityLocked);
  assert.throws(() => complete(target, { legalName: 'Express Cameroun SARL' }, 3), AgencyIdentityLocked);
  assert.equal(target.snapshot().identity.legalName, null);
  assert.equal(target.snapshot().version, 4);
});

test('an update built on another version is refused and changes nothing', () => {
  for (const expected of [3, 5]) {
    const target = agency('draft', 4);
    assert.throws(() => complete(target, { legalName: 'Express Douala SARL' }, expected), StaleAgencyVersion);
    assert.deepEqual([target.snapshot().identity.legalName, target.snapshot().version, target.pullEvents()], [null, 4, []]);
  }
});

test('a stale version is refused even when nothing would change', () => {
  assert.throws(() => complete(agency('draft', 4), {}, 3), StaleAgencyVersion);
});

test('the profile changes its trade name and description, raises the version and names the fields', () => {
  const target = agency();
  target.updateProfile(profileChangeOf({ description: ' Livraison express à Douala ' }), ACTOR, 1);
  assert.deepEqual([target.snapshot().description?.value, target.snapshot().tradeName.value, target.snapshot().version], ['Livraison express à Douala', 'Express Douala', 2]);
  target.updateProfile(profileChangeOf({ tradeName: 'Express Douala & Littoral' }), ACTOR, 2);
  assert.deepEqual([target.snapshot().description?.value, target.snapshot().tradeName.value, target.snapshot().version], ['Livraison express à Douala', 'Express Douala & Littoral', 3]);
  assert.deepEqual(target.pullEvents(), [
    { type: 'AgencyProfileUpdated', agencyId: uuid(10), actorId: uuid(2), fields: ['description'] },
    { type: 'AgencyProfileUpdated', agencyId: uuid(10), actorId: uuid(2), fields: ['tradeName'] },
  ]);
});

test('the profile stays editable once the agency is submitted, and the status is left alone', () => {
  const target = agency('submitted', 5);
  target.updateProfile(profileChangeOf({ description: 'Livraison et stockage à Douala' }), ACTOR, 5);
  assert.deepEqual([target.snapshot().status, target.snapshot().version, target.snapshot().description?.value], ['submitted', 6, 'Livraison et stockage à Douala']);
});

test('the description can be cleared but the trade name cannot', () => {
  const target = agency();
  target.updateProfile(profileChangeOf({ description: 'Livraison express' }), ACTOR, 1);
  target.updateProfile(profileChangeOf({ description: null }), ACTOR, 2);
  assert.equal(target.snapshot().description, null);
  assert.throws(() => profileChangeOf({ tradeName: '   ' }), Error);
  assert.throws(() => profileChangeOf({ description: 'x'.repeat(1001) }), InvalidAgencyField);
  assert.equal(profileChangeOf({ description: 'x'.repeat(1000) }).description?.value.length, 1000);
});

test('a profile update without real change, or on a stale version, writes nothing', () => {
  const target = agency('draft', 3);
  target.updateProfile(profileChangeOf({ tradeName: ' Express Douala ' }), ACTOR, 3);
  target.updateProfile(profileChangeOf({ description: null }), ACTOR, 3);
  assert.deepEqual([target.snapshot().version, target.pullEvents()], [3, []]);
  assert.throws(() => target.updateProfile(profileChangeOf({ description: 'Ancienne présentation' }), ACTOR, 2), StaleAgencyVersion);
  assert.equal(target.snapshot().description, null);
});

test('values built outside the factories are still compared by value', () => {
  const target = agency();
  target.completeIdentity({ legalName: LegalName.of('Express Douala SARL'), primaryPhone: PrimaryPhone.of('677123456') }, ACTOR, 1);
  target.completeIdentity({ legalName: LegalName.of('Express Douala SARL') }, ACTOR, 2);
  assert.equal(target.snapshot().version, 2);
});
