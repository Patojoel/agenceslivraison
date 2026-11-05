import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { T0 } from '@shared/tests/doubles/fakes';
import { composePublicListing } from '../../domain/public-listing';
import { PublicProfileSnapshot } from '../../domain/agency-public-profile';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { PublicSlug } from '../../domain/value-objects/public-slug';
import { AGENCY, AKWA, BONABERI, OWNER, view } from '../doubles/fakes';

const profile = (published = true): PublicProfileSnapshot => ({
  agencyId: AgencyId.of(AGENCY), slug: PublicSlug.reconstitute('express-douala'), published, publishedAt: T0, publishedBy: UserId.of(OWNER), unpublishedAt: published ? null : T0,
});

test('the listing holds exactly the fields the specification allows, and nothing else', () => {
  const listing = composePublicListing(profile(), view(), new Map([[AKWA, 1000]]));
  assert.deepEqual(Object.keys(listing).sort(), ['agencyId', 'capabilities', 'description', 'name', 'nameKey', 'publishedAt', 'siteCities', 'slug', 'verification', 'visible', 'zones']);
  assert.deepEqual(Object.keys(listing.zones[0] ?? {}).sort(), ['city', 'district', 'id', 'startingPrice']);
});

test('a submitted agency is shown as not verified, never as guaranteed, insured or certified', () => {
  const listing = composePublicListing(profile(), view(), new Map());
  assert.equal(listing.verification, 'unverified');
  assert.equal(/garanti|assur|certifi|verified"/i.test(JSON.stringify({ ...listing, verification: undefined })), false);
});

test('each active zone carries the lowest price of the rate card in force, or none when it is not priced', () => {
  const listing = composePublicListing(profile(), view(), new Map([[AKWA, 1000]]));
  assert.deepEqual(listing.zones.map(zone => [zone.id, zone.startingPrice]), [[AKWA, 1000], [BONABERI, null]]);
});

test('an agency without a rate card has every zone on quote', () => {
  assert.deepEqual(composePublicListing(profile(), view(), new Map()).zones.map(zone => zone.startingPrice), [null, null]);
});

test('a price of a zone that is not served any more is ignored', () => {
  const listing = composePublicListing(profile(), view({ zones: [{ id: AKWA, city: 'Douala', district: 'Akwa' }] }), new Map([[AKWA, 1000], [BONABERI, 1500]]));
  assert.deepEqual(listing.zones.map(zone => zone.id), [AKWA]);
});

test('the listing carries the name, its comparison key, the description, the capabilities, the cities of the sites and the publication date', () => {
  const listing = composePublicListing(profile(), view({ tradeName: '  Éxpress   Douala ', siteCities: ['Douala', 'Kribi'], capabilities: ['storage', 'delivery'] }), new Map());
  assert.deepEqual([listing.name, listing.nameKey, listing.description, listing.capabilities, listing.siteCities, listing.publishedAt, listing.slug], ['Éxpress Douala', 'express douala', 'Livraison rapide', ['delivery', 'storage'], ['Douala', 'Kribi'], T0, 'express-douala']);
});

test('the description is kept as typed, markup included: it is text, escaped on display', () => {
  const listing = composePublicListing(profile(), view({ description: '<script>alert(1)</script> Livraison 7j/7' }), new Map());
  assert.equal(listing.description, '<script>alert(1)</script> Livraison 7j/7');
});

test('the listing is visible only when the profile is published and the agency still publishable', () => {
  assert.equal(composePublicListing(profile(), view(), new Map()).visible, true);
  assert.equal(composePublicListing(profile(false), view(), new Map()).visible, false);
  assert.equal(composePublicListing(profile(), view({ capabilities: [] }), new Map()).visible, false);
  assert.equal(composePublicListing(profile(), view({ tradeName: 'Express‮Douala' }), new Map()).visible, false);
  assert.equal(composePublicListing(profile(), view({ tradeName: `Agence ${AGENCY.slice(0, 8)}` }), new Map()).visible, false);
  assert.equal(composePublicListing(profile(), view({ submitted: false }), new Map()).visible, false);
});
