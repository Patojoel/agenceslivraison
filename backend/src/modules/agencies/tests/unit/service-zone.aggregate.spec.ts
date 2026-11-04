import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { T0, uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import {
  InvalidAgencyField, LastActiveZone, ServiceZoneAlreadyRetired, ServiceZoneAlreadyServed, ServiceZoneLimitReached, ServiceZoneNotFound,
} from '../../domain/exceptions/agency.exceptions';
import { ServiceArea } from '../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../domain/value-objects/service-zone-id';
import { SuspensionReason } from '../../domain/value-objects/suspension-reason';
import { anAgency, withActiveZone } from '../doubles/fakes';

const ACTOR = UserId.of(uuid(2));
const LATER = new Date('2026-02-01T00:00:00.000Z');
const SUSPENSION = SuspensionReason.of('Inventaire annuel');
const zoneId = (n: number) => ServiceZoneId.of(uuid(500 + n));

function add(agency: Agency, n: number, city: string, district: string | null = null) {
  return agency.addZone(zoneId(n), ServiceArea.of(city, district), ACTOR, T0);
}

test('adding a zone makes it active, keeps the typed spelling and records ServiceZoneAdded', () => {
  const agency = anAgency();
  const zone = add(agency, 1, ' Douala ', ' Akwa ');
  assert.deepEqual([zone.area.city, zone.area.district, zone.retiredAt, zone.addedAt], ['Douala', 'Akwa', null, T0]);
  assert.equal(agency.snapshot().zones.length, 1);
  assert.deepEqual(agency.pullEvents(), [{ type: 'ServiceZoneAdded', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(501), reactivated: false }]);
});

test('a zone without a district covers the whole city; a blank district means none', () => {
  const agency = anAgency();
  assert.equal(add(agency, 1, 'Yaoundé').area.district, null);
  assert.equal(add(agency, 2, 'Kribi', '   ').area.district, null);
});

test('zone changes leave the agency version alone: only identity and profile move it', () => {
  const agency = anAgency('draft', 4);
  add(agency, 1, 'Douala', 'Akwa');
  agency.retireZone(zoneId(1), ACTOR, LATER);
  assert.equal(agency.snapshot().version, 4);
});

test('the same zone is refused whatever the case, accents and spacing', () => {
  const variants: readonly (readonly [string, string])[] = [['Douala', 'Akwa'], ['douala', 'AKWA'], ['Douala', 'Akwá'], ['  DOUALA ', ' akwa '], ['Doualà', 'Akwa']];
  for (const [city, district] of variants) {
    const agency = anAgency();
    add(agency, 1, 'Douala', 'Akwa');
    assert.throws(() => add(agency, 2, city, district), ServiceZoneAlreadyServed, `${city} / ${district}`);
    assert.equal(agency.snapshot().zones.length, 1);
  }
});

test('inner runs of spaces do not make a zone different', () => {
  const agency = anAgency();
  add(agency, 1, 'Bonamoussadi Ouest');
  assert.throws(() => add(agency, 2, 'bonamoussadi   ouest'), ServiceZoneAlreadyServed);
});

test('a city and the same city with a district are different zones', () => {
  const agency = anAgency();
  add(agency, 1, 'Douala');
  add(agency, 2, 'Douala', 'Akwa');
  assert.equal(agency.snapshot().zones.length, 2);
});

test('city and district keep 2 to 80 characters, counted as PostgreSQL does', () => {
  assert.throws(() => ServiceArea.of('x', null), InvalidAgencyField);
  assert.equal(ServiceArea.of('xx', null).city, 'xx');
  assert.equal(ServiceArea.of('x'.repeat(80), null).city.length, 80);
  assert.throws(() => ServiceArea.of('x'.repeat(81), null), InvalidAgencyField);
  assert.throws(() => ServiceArea.of('Douala', 'x'), InvalidAgencyField);
  assert.equal(ServiceArea.of('Douala', 'x'.repeat(80)).district?.length, 80);
  assert.throws(() => ServiceArea.of('Douala', 'x'.repeat(81)), InvalidAgencyField);
  assert.throws(() => ServiceArea.of('😀', null), InvalidAgencyField);
  assert.throws(() => ServiceArea.of('Dou\u0000ala', null), InvalidAgencyField);
});

test('the comparison key ignores case, accents and spacing', () => {
  const a = ServiceArea.of('Yaoundé', 'Mvog  Ada');
  const b = ServiceArea.of('YAOUNDE', 'mvog ada');
  assert.deepEqual([a.cityKey, a.districtKey], ['yaounde', 'mvog ada']);
  assert.equal(a.sameAs(b), true);
  assert.equal(ServiceArea.of('Yaoundé', null).districtKey, '');
  assert.equal(ServiceArea.of('Yaoundé', null).sameAs(ServiceArea.of('Yaoundé', 'Bastos')), false);
});

test('retiring a zone keeps it, with its retirement date, and leaves the others active', () => {
  const agency = withActiveZone(anAgency(), 1, 'Douala', 'Akwa');
  add(agency, 2, 'Douala', 'Bonabéri');
  agency.pullEvents();
  const retired = agency.retireZone(zoneId(2), ACTOR, LATER);
  assert.equal(retired.retiredAt, LATER);
  assert.deepEqual(agency.snapshot().zones.map(zone => [zone.area.district, zone.retiredAt]), [['Akwa', null], ['Bonabéri', LATER]]);
  assert.deepEqual(agency.pullEvents(), [{ type: 'ServiceZoneRetired', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(502) }]);
});

test('adding a retired zone again reactivates the very same zone instead of creating a second one', () => {
  const agency = anAgency();
  add(agency, 1, 'Douala', 'Bonabéri');
  agency.retireZone(zoneId(1), ACTOR, LATER);
  agency.pullEvents();
  const back = add(agency, 2, 'douala', 'BONABÉRI');
  assert.deepEqual([back.id.value, back.retiredAt], [uuid(501), null]);
  assert.equal(agency.snapshot().zones.length, 1);
  assert.deepEqual(agency.pullEvents(), [{ type: 'ServiceZoneAdded', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(501), reactivated: true }]);
});

test('retiring a zone twice, or an unknown zone, is refused without any event', () => {
  const agency = anAgency();
  add(agency, 1, 'Douala');
  agency.retireZone(zoneId(1), ACTOR, LATER);
  agency.pullEvents();
  assert.throws(() => agency.retireZone(zoneId(1), ACTOR, LATER), ServiceZoneAlreadyRetired);
  assert.throws(() => agency.retireZone(zoneId(9), ACTOR, LATER), ServiceZoneNotFound);
  assert.deepEqual(agency.pullEvents(), []);
});

test('the last active zone stays while delivery is active', () => {
  const agency = withActiveZone(anAgency(), 1, 'Douala', 'Akwa');
  agency.enableCapability('delivery', ACTOR, T0);
  assert.throws(() => agency.retireZone(zoneId(1), ACTOR, LATER), LastActiveZone);
  assert.equal(agency.snapshot().zones[0]?.retiredAt, null);
  add(agency, 2, 'Douala', 'Bonabéri');
  agency.retireZone(zoneId(1), ACTOR, LATER);
  assert.throws(() => agency.retireZone(zoneId(2), ACTOR, LATER), LastActiveZone);
});

test('the last active zone can go when delivery is not active, or is suspended', () => {
  const idle = withActiveZone(anAgency(), 1, 'Douala', 'Akwa');
  idle.retireZone(zoneId(1), ACTOR, LATER);
  assert.equal(idle.snapshot().zones[0]?.retiredAt, LATER);

  const suspended = withActiveZone(anAgency(), 1, 'Douala', 'Akwa');
  suspended.enableCapability('delivery', ACTOR, T0);
  suspended.suspendCapability('delivery', SUSPENSION, ACTOR, T0);
  suspended.retireZone(zoneId(1), ACTOR, LATER);
  assert.equal(suspended.snapshot().zones[0]?.retiredAt, LATER);
});

test('an agency serves at most 100 active zones; a retired one frees a place', () => {
  const agency = anAgency();
  for (let n = 1; n <= 100; n++) add(agency, n, `Ville ${n}`);
  assert.throws(() => add(agency, 101, 'Kribi'), ServiceZoneLimitReached);
  assert.equal(agency.snapshot().zones.length, 100);
  agency.retireZone(zoneId(7), ACTOR, LATER);
  add(agency, 101, 'Kribi');
  assert.throws(() => add(agency, 102, 'Ville 7'), ServiceZoneLimitReached, 'reactivation counts as an addition');
  assert.equal(agency.snapshot().zones.filter(zone => zone.retiredAt === null).length, 100);
});

test('99 active zones still leave a place', () => {
  const agency = anAgency();
  for (let n = 1; n <= 99; n++) add(agency, n, `Ville ${n}`);
  add(agency, 100, 'Kribi');
  assert.equal(agency.snapshot().zones.length, 100);
});

test('a duplicate is reported as such even at the limit', () => {
  const agency = anAgency();
  for (let n = 1; n <= 100; n++) add(agency, n, `Ville ${n}`);
  assert.throws(() => add(agency, 101, 'Ville 5'), ServiceZoneAlreadyServed);
});

test('zones can be managed on a submitted agency', () => {
  const agency = anAgency('submitted', 3);
  add(agency, 1, 'Douala', 'Bépanda');
  assert.deepEqual([agency.snapshot().zones.length, agency.snapshot().status], [1, 'submitted']);
});
