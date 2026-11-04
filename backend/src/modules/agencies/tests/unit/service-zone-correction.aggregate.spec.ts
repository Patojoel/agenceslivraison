import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { T0, uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import {
  ServiceZoneAlreadyServed, ServiceZoneNotFound, ServiceZoneRetired, ServiceZoneRetiredDuplicate, ServiceZoneTotalLimitReached,
} from '../../domain/exceptions/agency.exceptions';
import { MAX_ZONES_TOTAL } from '../../domain/service-zone';
import { ServiceArea } from '../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../domain/value-objects/service-zone-id';
import { anAgency, withActiveZone } from '../doubles/fakes';

const ACTOR = UserId.of(uuid(2));
const LATER = new Date('2026-02-01T00:00:00.000Z');
const zoneId = (n: number) => ServiceZoneId.of(uuid(500 + n));

function add(agency: Agency, n: number, city: string, district: string | null = null) {
  return agency.addZone(zoneId(n), ServiceArea.of(city, district), ACTOR, T0);
}

function correct(agency: Agency, n: number, city: string, district: string | null = null) {
  return agency.correctZone(zoneId(n), ServiceArea.of(city, district), ACTOR);
}

test('correcting a zone keeps its identifier and its dates, changes the spelling and records ServiceZoneRenamed with the field names', () => {
  const agency = withActiveZone(anAgency('submitted', 4), 1, 'Douala', 'Akwaa');
  const zone = correct(agency, 1, 'Douala', 'Akwa');
  assert.deepEqual([zone.id.value, zone.area.city, zone.area.district, zone.addedAt, zone.retiredAt], [uuid(501), 'Douala', 'Akwa', T0, null]);
  assert.deepEqual(agency.snapshot().zones.map(item => item.area.district), ['Akwa']);
  assert.equal(agency.snapshot().version, 4, 'a zone never moves the agency version');
  assert.deepEqual(agency.pullEvents(), [{ type: 'ServiceZoneRenamed', agencyId: uuid(10), actorId: uuid(2), zoneId: uuid(501), fields: ['district'] }]);
});

test('the event lists city and district when both change, and the district when it is added or dropped', () => {
  const agency = withActiveZone(anAgency(), 1, 'Duala', 'Akwaa');
  correct(agency, 1, 'Douala', 'Akwa');
  correct(agency, 1, 'Douala');
  correct(agency, 1, 'Douala', 'Akwa');
  assert.deepEqual(agency.pullEvents().map(event => (event.type === 'ServiceZoneRenamed' ? event.fields : null)), [['city', 'district'], ['district'], ['district']]);
});

test('a strictly identical correction changes nothing and records nothing; a change of case or accent alone is a correction', () => {
  const agency = withActiveZone(anAgency(), 1, 'Douala', 'Bonabéri');
  const same = correct(agency, 1, ' Douala ', 'Bonabéri');
  assert.equal(same, agency.snapshot().zones[0]);
  assert.deepEqual(agency.pullEvents(), []);
  correct(agency, 1, 'douala', 'BONABERI');
  assert.deepEqual(agency.snapshot().zones.map(zone => [zone.area.city, zone.area.district]), [['douala', 'BONABERI']]);
  assert.equal(agency.pullEvents().length, 1);
});

test('a correction towards another active zone, whatever the case, accents and spacing, is a duplicate', () => {
  const agency = withActiveZone(withActiveZone(anAgency(), 1, 'Douala', 'Akwaa'), 2, 'Douala', 'Deïdo');
  assert.throws(() => correct(agency, 1, 'douala', 'DEIDO'), ServiceZoneAlreadyServed);
  assert.equal(agency.snapshot().zones[0]?.area.district, 'Akwaa');
  assert.deepEqual(agency.pullEvents(), []);
});

test('a correction towards a retired zone is refused: the retired zone has to be reactivated instead', () => {
  const agency = withActiveZone(withActiveZone(anAgency(), 1, 'Douala', 'Akwaa'), 2, 'Douala', 'Bépanda');
  agency.retireZone(zoneId(2), ACTOR, LATER);
  agency.pullEvents();
  assert.throws(() => correct(agency, 1, 'Douala', 'Bépanda'), (error: unknown) => error instanceof ServiceZoneRetiredDuplicate && error.kind === 'conflict' && error.extras?.code === 'ZONE_RETIRED_DUPLICATE');
  assert.equal(agency.snapshot().zones[0]?.area.district, 'Akwaa');
  assert.deepEqual(agency.pullEvents(), []);
});

test('a retired zone cannot be corrected', () => {
  const agency = withActiveZone(anAgency(), 1, 'Douala', 'Bépanda');
  agency.retireZone(zoneId(1), ACTOR, LATER);
  agency.pullEvents();
  assert.throws(() => correct(agency, 1, 'Douala', 'Bépanda Omnisport'), (error: unknown) => error instanceof ServiceZoneRetired && error.kind === 'conflict' && error.extras?.code === 'ZONE_RETIRED');
  assert.deepEqual(agency.pullEvents(), []);
});

test('an unknown zone is not found', () => {
  assert.throws(() => correct(withActiveZone(anAgency(), 1, 'Douala'), 9, 'Kribi'), ServiceZoneNotFound);
});

test('correcting a zone is not an addition: it works at the limits of the agency', () => {
  const agency = anAgency();
  for (let n = 1; n <= 100; n++) add(agency, n, `Ville ${n}`);
  correct(agency, 1, 'Douala', 'Akwa');
  assert.equal(agency.snapshot().zones.length, 100);
});

function agencyWithZones(total: number): Agency {
  const agency = anAgency();
  for (let n = 1; n <= total; n++) {
    add(agency, n, `Ville ${n}`);
    if (n <= total - 50) agency.retireZone(zoneId(n), ACTOR, LATER);
  }
  agency.pullEvents();
  return agency;
}

test('an agency keeps at most 300 zones, active or retired: a new zone is refused beyond, with its own code', () => {
  const agency = agencyWithZones(MAX_ZONES_TOTAL);
  assert.equal(agency.snapshot().zones.length, 300);
  assert.throws(() => add(agency, 301, 'Kribi'), (error: unknown) => error instanceof ServiceZoneTotalLimitReached && error.kind === 'conflict' && error.extras?.code === 'ZONE_TOTAL_LIMIT_REACHED');
  assert.equal(agency.snapshot().zones.length, 300);
  assert.deepEqual(agency.pullEvents(), []);
});

test('299 zones still leave a place; the reactivation of a retired zone creates no new row and is always possible', () => {
  const almost = agencyWithZones(MAX_ZONES_TOTAL - 1);
  add(almost, 300, 'Kribi');
  assert.equal(almost.snapshot().zones.length, 300);
  const full = agencyWithZones(MAX_ZONES_TOTAL);
  const back = add(full, 999, 'Ville 1');
  assert.deepEqual([back.id.value, back.retiredAt, full.snapshot().zones.length], [uuid(501), null, 300]);
});

test('a duplicate is reported as such at the total limit', () => {
  assert.throws(() => add(agencyWithZones(MAX_ZONES_TOTAL), 301, 'Ville 300'), ServiceZoneAlreadyServed);
});
