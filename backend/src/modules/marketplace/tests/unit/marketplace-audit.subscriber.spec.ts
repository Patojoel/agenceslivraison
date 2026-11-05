import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditLog } from '@shared/tests/doubles/fakes';
import { MarketplaceAuditSubscriber } from '../../application/subscribers/marketplace-audit.subscriber';
import { AGENCY, OWNER } from '../doubles/fakes';

test('publication and withdrawal are traced with the agency as resource, and no value', async () => {
  const audit = new InMemoryAuditLog();
  const subscriber = new MarketplaceAuditSubscriber(audit);
  await subscriber.handle({ type: 'AgencyPublicProfilePublished', agencyId: AGENCY, actorId: OWNER } as never);
  await subscriber.handle({ type: 'AgencyPublicProfileUnpublished', agencyId: AGENCY, actorId: OWNER } as never);
  assert.deepEqual(audit.entries, [
    { userId: OWNER, action: 'marketplace.profile_published', agencyId: AGENCY, resourceId: AGENCY },
    { userId: OWNER, action: 'marketplace.profile_unpublished', agencyId: AGENCY, resourceId: AGENCY },
  ]);
});

test('events of other modules are ignored', async () => {
  const audit = new InMemoryAuditLog();
  await new MarketplaceAuditSubscriber(audit).handle({ type: 'AgencySubmittedForVerification' });
  assert.deepEqual(audit.entries, []);
});
