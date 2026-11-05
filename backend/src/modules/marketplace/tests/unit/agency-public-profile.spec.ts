import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { T0 } from '@shared/tests/doubles/fakes';
import { AgencyPublicProfile } from '../../domain/agency-public-profile';
import { AgencyNotSubmitted, NoActiveCapability, ProfileAlreadyPublished, ProfileNotPublished, ProvisionalTradeName } from '../../domain/exceptions/marketplace.exceptions';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { PublicSlug } from '../../domain/value-objects/public-slug';
import { AGENCY, OWNER, view } from '../doubles/fakes';

const agencyId = AgencyId.of(AGENCY);
const actor = UserId.of(OWNER);
const later = new Date(T0.getTime() + 3_600_000);
const first = (overrides = {}) => AgencyPublicProfile.publishFirst({ agencyId, slug: PublicSlug.fromName('Express Douala', 1), view: view(overrides), actorId: actor, now: T0 });

test('the first publication publishes under the slug and records one event', () => {
  const profile = first();
  const snapshot = profile.snapshot();
  assert.deepEqual([snapshot.slug.value, snapshot.published, snapshot.publishedAt, snapshot.publishedBy.value, snapshot.unpublishedAt], ['express-douala', true, T0, OWNER, null]);
  assert.deepEqual(profile.pullEvents(), [{ type: 'AgencyPublicProfilePublished', agencyId: AGENCY, actorId: OWNER }]);
});

test('the first publication refuses what the rules refuse', () => {
  assert.throws(() => first({ submitted: false }), AgencyNotSubmitted);
  assert.throws(() => first({ capabilities: [] }), NoActiveCapability);
  assert.throws(() => first({ tradeName: `Agence ${AGENCY.slice(0, 8)}` }), ProvisionalTradeName);
});

test('publishing a published profile is a conflict with no second effect', () => {
  const profile = first();
  profile.pullEvents();
  assert.throws(() => profile.publish(view(), actor, later), ProfileAlreadyPublished);
  assert.equal(profile.snapshot().publishedAt, T0);
  assert.deepEqual(profile.pullEvents(), []);
});

test('unpublishing a published profile retires it and keeps the slug', () => {
  const profile = first();
  profile.pullEvents();
  profile.unpublish(actor, later);
  const snapshot = profile.snapshot();
  assert.deepEqual([snapshot.published, snapshot.unpublishedAt, snapshot.slug.value], [false, later, 'express-douala']);
  assert.deepEqual(profile.pullEvents(), [{ type: 'AgencyPublicProfileUnpublished', agencyId: AGENCY, actorId: OWNER }]);
});

test('unpublishing an unpublished profile is a conflict with no second effect', () => {
  const profile = first();
  profile.unpublish(actor, later);
  profile.pullEvents();
  assert.throws(() => profile.unpublish(actor, later), ProfileNotPublished);
  assert.deepEqual(profile.pullEvents(), []);
});

test('publishing again after a withdrawal keeps the slug and dates the new publication', () => {
  const profile = first();
  profile.unpublish(actor, later);
  profile.pullEvents();
  const muchLater = new Date(later.getTime() + 3_600_000);
  profile.publish(view(), actor, muchLater);
  const snapshot = profile.snapshot();
  assert.deepEqual([snapshot.slug.value, snapshot.published, snapshot.publishedAt, snapshot.unpublishedAt], ['express-douala', true, muchLater, null]);
  assert.equal(profile.pullEvents().length, 1);
});

test('republishing refuses an agency that is no longer publishable', () => {
  const profile = first();
  profile.unpublish(actor, later);
  assert.throws(() => profile.publish(view({ capabilities: [] }), actor, later), NoActiveCapability);
  assert.equal(profile.snapshot().published, false);
});
