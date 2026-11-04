import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { T0, uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import { RawSiteDetails, siteChangeOf, siteDetailsOf } from '../../domain/agency-site';
import {
  AgencySiteNotFound, InvalidAgencyField, LastActiveSite, SiteAlreadyActive, SiteDeactivated, SiteNameTaken, StaleSiteVersion,
} from '../../domain/exceptions/agency.exceptions';
import { AgencySiteId } from '../../domain/value-objects/agency-site-id';
import { SuspensionReason } from '../../domain/value-objects/suspension-reason';
import { anAgency, withActiveZone } from '../doubles/fakes';

const ACTOR = UserId.of(uuid(2));
const LATER = new Date('2026-02-01T00:00:00.000Z');
const siteId = (n: number) => AgencySiteId.of(uuid(600 + n));
const AKWA: RawSiteDetails = { name: 'Agence Akwa', city: 'Douala', address: 'Rue Joss, face Total Akwa', phone: null };

function create(agency: Agency, n: number, raw: RawSiteDetails = AKWA) {
  return agency.createSite(siteId(n), siteDetailsOf(raw), ACTOR, T0);
}

test('creating a site makes it active at version 1 and records AgencySiteCreated', () => {
  const agency = anAgency();
  const site = create(agency, 1, { ...AKWA, name: '  Agence  Akwa ', phone: '6 77 12 34 56' });
  assert.deepEqual([site.name.value, site.city.value, site.phone?.value, site.version, site.deactivatedAt, site.createdAt], ['Agence Akwa', 'Douala', '+237677123456', 1, null, T0]);
  assert.deepEqual(agency.pullEvents(), [{ type: 'AgencySiteCreated', agencyId: uuid(10), actorId: uuid(2), siteId: uuid(601) }]);
  assert.equal(agency.snapshot().version, 1, 'the agency version is not the site version');
});

test('the phone of a site is optional and follows the rule of the primary phone', () => {
  assert.equal(create(anAgency(), 1, { ...AKWA, phone: '  ' }).phone, null);
  assert.throws(() => siteDetailsOf({ ...AKWA, phone: '677 12 34' }), InvalidAgencyField);
  assert.throws(() => siteDetailsOf({ ...AKWA, phone: '+33 6 12 34 56 78' }), InvalidAgencyField);
});

test('site fields keep their bounds: name 2-120, city 2-80, address 5-300', () => {
  const bounds: readonly (readonly ['name' | 'city' | 'address', number, number])[] = [['name', 2, 120], ['city', 2, 80], ['address', 5, 300]];
  for (const [field, min, max] of bounds) {
    assert.throws(() => siteDetailsOf({ ...AKWA, [field]: 'x'.repeat(min - 1) }), InvalidAgencyField, `${field} below`);
    assert.equal(siteDetailsOf({ ...AKWA, [field]: 'x'.repeat(min) })[field].value.length, min);
    assert.equal(siteDetailsOf({ ...AKWA, [field]: 'x'.repeat(max) })[field].value.length, max);
    assert.throws(() => siteDetailsOf({ ...AKWA, [field]: 'x'.repeat(max + 1) }), InvalidAgencyField, `${field} above`);
    assert.throws(() => siteDetailsOf({ ...AKWA, [field]: `${'x'.repeat(min)}\u0000` }), InvalidAgencyField, `${field} control character`);
  }
});

test('two active sites cannot share a name, whatever case, accents and spacing', () => {
  for (const name of ['Agence Akwa', 'agence AKWA', 'Agence  Akwà', ' AGENCE akwa ']) {
    const agency = anAgency();
    create(agency, 1);
    assert.throws(() => create(agency, 2, { ...AKWA, name }), SiteNameTaken, name);
    assert.equal(agency.snapshot().sites.length, 1);
  }
});

test('a deactivated site frees its name', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.deactivateSite(siteId(1), ACTOR, LATER);
  create(agency, 2);
  assert.equal(agency.snapshot().sites.filter(site => site.deactivatedAt === null).length, 1);
});

test('updating a site raises its own version, says which fields changed and keeps the others', () => {
  const agency = anAgency('draft', 7);
  create(agency, 1);
  agency.pullEvents();
  const site = agency.updateSite(siteId(1), siteChangeOf({ address: 'Rue Joss, immeuble Bleu', phone: '677 12 34 56' }), ACTOR, 1);
  assert.deepEqual([site.version, site.address.value, site.phone?.value, site.name.value, site.city.value], [2, 'Rue Joss, immeuble Bleu', '+237677123456', 'Agence Akwa', 'Douala']);
  assert.equal(agency.snapshot().version, 7, 'the agency version is untouched');
  assert.deepEqual(agency.pullEvents(), [{ type: 'AgencySiteUpdated', agencyId: uuid(10), actorId: uuid(2), siteId: uuid(601), fields: ['address', 'phone'] }]);
});

test('the phone of a site can be cleared with null', () => {
  const agency = anAgency();
  create(agency, 1, { ...AKWA, phone: '677123456' });
  const site = agency.updateSite(siteId(1), siteChangeOf({ phone: null }), ACTOR, 1);
  assert.deepEqual([site.phone, site.version], [null, 2]);
});

test('the name, the city and the address of a site cannot be cleared', () => {
  for (const raw of [{ name: null }, { city: null }, { address: null }]) assert.throws(() => siteChangeOf(raw), InvalidAgencyField, JSON.stringify(raw));
});

test('an update that changes nothing keeps the version and records nothing', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.pullEvents();
  const site = agency.updateSite(siteId(1), siteChangeOf({ name: 'Agence  Akwa', city: 'Douala' }), ACTOR, 1);
  assert.equal(site.version, 1);
  assert.deepEqual(agency.pullEvents(), []);
});

test('an update on a stale site version is refused', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.updateSite(siteId(1), siteChangeOf({ city: 'Yaoundé' }), ACTOR, 1);
  assert.throws(() => agency.updateSite(siteId(1), siteChangeOf({ city: 'Kribi' }), ACTOR, 1), StaleSiteVersion);
  assert.throws(() => agency.updateSite(siteId(1), siteChangeOf({ city: 'Kribi' }), ACTOR, 3), StaleSiteVersion);
  assert.equal(agency.snapshot().sites[0]?.city.value, 'Yaoundé');
});

test('a site cannot be renamed to the name of another active site', () => {
  const agency = anAgency();
  create(agency, 1);
  create(agency, 2, { ...AKWA, name: 'Dépôt Bonabéri' });
  assert.throws(() => agency.updateSite(siteId(2), siteChangeOf({ name: 'agence akwa' }), ACTOR, 1), SiteNameTaken);
  assert.equal(agency.updateSite(siteId(2), siteChangeOf({ name: 'DÉPÔT BONABÉRI' }), ACTOR, 1).version, 2, 'a change of case on its own name is allowed');
});

test('only an active site can be modified; an unknown site is not found', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.deactivateSite(siteId(1), ACTOR, LATER);
  assert.throws(() => agency.updateSite(siteId(1), siteChangeOf({ city: 'Kribi' }), ACTOR, 2), SiteDeactivated);
  assert.throws(() => agency.updateSite(siteId(9), siteChangeOf({ city: 'Kribi' }), ACTOR, 1), AgencySiteNotFound);
});

test('deactivating keeps the site with its date, and reactivating brings it back', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.pullEvents();
  const off = agency.deactivateSite(siteId(1), ACTOR, LATER);
  assert.deepEqual([off.deactivatedAt, off.version], [LATER, 2]);
  assert.equal(agency.snapshot().sites.length, 1);
  const on = agency.reactivateSite(siteId(1), ACTOR);
  assert.deepEqual([on.deactivatedAt, on.version], [null, 3]);
  assert.deepEqual(agency.pullEvents().map(event => event.type), ['AgencySiteDeactivated', 'AgencySiteReactivated']);
});

test('deactivating twice, or reactivating an active site, is refused', () => {
  const agency = anAgency();
  create(agency, 1);
  assert.throws(() => agency.reactivateSite(siteId(1), ACTOR), SiteAlreadyActive);
  agency.deactivateSite(siteId(1), ACTOR, LATER);
  agency.pullEvents();
  assert.throws(() => agency.deactivateSite(siteId(1), ACTOR, LATER), SiteDeactivated);
  assert.throws(() => agency.deactivateSite(siteId(9), ACTOR, LATER), AgencySiteNotFound);
  assert.deepEqual(agency.pullEvents(), []);
});

test('a site cannot come back while another active site has its name', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.deactivateSite(siteId(1), ACTOR, LATER);
  create(agency, 2, { ...AKWA, name: 'AGENCE AKWA' });
  assert.throws(() => agency.reactivateSite(siteId(1), ACTOR), SiteNameTaken);
  assert.notEqual(agency.snapshot().sites[0]?.deactivatedAt, null);
});

test('the last active site stays while storage is active', () => {
  const agency = anAgency();
  create(agency, 1);
  agency.enableCapability('storage', ACTOR, T0);
  assert.throws(() => agency.deactivateSite(siteId(1), ACTOR, LATER), LastActiveSite);
  create(agency, 2, { ...AKWA, name: 'Dépôt Bonabéri' });
  agency.deactivateSite(siteId(1), ACTOR, LATER);
  assert.throws(() => agency.deactivateSite(siteId(2), ACTOR, LATER), LastActiveSite);
});

test('the last active site can go when storage is not active, or is suspended', () => {
  const idle = anAgency();
  create(idle, 1);
  idle.deactivateSite(siteId(1), ACTOR, LATER);
  assert.equal(idle.snapshot().sites[0]?.deactivatedAt, LATER);

  const suspended = anAgency();
  create(suspended, 1);
  suspended.enableCapability('storage', ACTOR, T0);
  suspended.suspendCapability('storage', SuspensionReason.of('Inventaire annuel'), ACTOR, T0);
  suspended.deactivateSite(siteId(1), ACTOR, LATER);
  assert.equal(suspended.snapshot().sites[0]?.deactivatedAt, LATER);
});

test('delivery being active does not protect the last site', () => {
  const agency = withActiveZone(anAgency(), 1, 'Douala', 'Akwa');
  agency.enableCapability('delivery', ACTOR, T0);
  create(agency, 1);
  agency.deactivateSite(siteId(1), ACTOR, LATER);
  assert.equal(agency.snapshot().sites[0]?.deactivatedAt, LATER);
});

test('sites can be managed on a submitted agency', () => {
  const agency = anAgency('submitted', 3);
  create(agency, 1);
  assert.equal(agency.snapshot().sites.length, 1);
});
