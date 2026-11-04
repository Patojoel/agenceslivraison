import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { T0, uuid } from '@shared/tests/doubles/fakes';
import { Agency } from '../../domain/agency';
import { MAX_ACTIVE_SITES, MAX_SITES_TOTAL, RawSiteDetails, siteDetailsOf } from '../../domain/agency-site';
import { ActiveSiteLimitReached, SiteNameTaken, SiteTotalLimitReached } from '../../domain/exceptions/agency.exceptions';
import { AgencySiteId } from '../../domain/value-objects/agency-site-id';
import { anAgency } from '../doubles/fakes';

const ACTOR = UserId.of(uuid(2));
const LATER = new Date('2026-02-01T00:00:00.000Z');
const siteId = (n: number) => AgencySiteId.of(uuid(600 + n));
const named = (n: number): RawSiteDetails => ({ name: `Site ${n}`, city: 'Douala', address: 'Rue Joss, face Total Akwa', phone: null });

function create(agency: Agency, n: number) {
  return agency.createSite(siteId(n), siteDetailsOf(named(n)), ACTOR, T0);
}

/** `total` sites, the first ones deactivated so that `active` remain. */
function agencyWithSites(total: number, active: number): Agency {
  const agency = anAgency();
  for (let n = 1; n <= total; n++) {
    create(agency, n);
    if (n <= total - active) agency.deactivateSite(siteId(n), ACTOR, LATER);
  }
  agency.pullEvents();
  return agency;
}

test('an agency has at most 50 active sites: the 51st creation is refused, a deactivation frees a place', () => {
  const agency = agencyWithSites(MAX_ACTIVE_SITES, MAX_ACTIVE_SITES);
  assert.throws(() => create(agency, 51), (error: unknown) => error instanceof ActiveSiteLimitReached && error.kind === 'conflict' && error.extras?.code === 'SITE_LIMIT_REACHED');
  agency.deactivateSite(siteId(3), ACTOR, LATER);
  create(agency, 51);
  assert.equal(agency.snapshot().sites.length, 51);
});

test('49 active sites still leave a place', () => {
  const agency = agencyWithSites(49, 49);
  create(agency, 50);
  assert.equal(agency.snapshot().sites.length, 50);
});

test('reactivating a site counts as an active site too', () => {
  const agency = agencyWithSites(MAX_ACTIVE_SITES + 1, MAX_ACTIVE_SITES);
  assert.throws(() => agency.reactivateSite(siteId(1), ACTOR), ActiveSiteLimitReached);
  agency.deactivateSite(siteId(5), ACTOR, LATER);
  agency.reactivateSite(siteId(1), ACTOR);
  assert.equal(agency.snapshot().sites[0]?.deactivatedAt, null);
});

test('an agency keeps at most 200 sites, active or deactivated, and says so with its own code', () => {
  const agency = agencyWithSites(MAX_SITES_TOTAL, 10);
  assert.throws(() => create(agency, 201), (error: unknown) => error instanceof SiteTotalLimitReached && error.kind === 'conflict' && error.extras?.code === 'SITE_TOTAL_LIMIT_REACHED');
  assert.equal(agency.snapshot().sites.length, 200);
  assert.deepEqual(agency.pullEvents(), []);
  agency.reactivateSite(siteId(1), ACTOR);
  assert.equal(agency.snapshot().sites.length, 200, 'a reactivation creates no new site');
});

test('199 sites still leave a place', () => {
  const agency = agencyWithSites(MAX_SITES_TOTAL - 1, 10);
  create(agency, 200);
  assert.equal(agency.snapshot().sites.length, 200);
});

test('a name taken is reported as such even at the limits', () => {
  assert.throws(() => create(agencyWithSites(MAX_ACTIVE_SITES, MAX_ACTIVE_SITES), 50), SiteNameTaken);
});
