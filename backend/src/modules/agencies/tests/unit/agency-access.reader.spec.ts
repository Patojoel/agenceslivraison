import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadAgencyDeliveryRepository } from '../../application/ports/read-agency-delivery.repository';
import { AgencyAccessReader } from '../../application/queries/agency-access/agency-access.reader';
import { ReadAgencyPublicViewRepository } from '../../application/ports/read-agency-public-view.repository';
import { AgencyDeliveryState } from '../../application/read-models/agency-delivery.read-model';
import { AgencyPublicView } from '../../application/read-models/agency-public-view.read-model';
import { AgencyRole } from '../../domain/agency-role';
import { AGENCY, OWNER } from '../doubles/fakes';

const PUBLIC_VIEW: AgencyPublicView = { submitted: true, tradeName: 'Express Douala', description: null, capabilities: ['delivery'], zones: [{ id: '00000000-0000-4000-8000-000000000501', city: 'Douala', district: 'Akwa' }], siteCities: ['Douala'] };

class RecordingPublicView implements ReadAgencyPublicViewRepository {
  readonly calls: string[] = [];

  async publicViewOf(agencyId: string): Promise<AgencyPublicView | null> {
    this.calls.push(`view:${agencyId}`);
    return PUBLIC_VIEW;
  }

  async publicViewOfLockedShared(agencyId: string): Promise<AgencyPublicView | null> {
    this.calls.push(`view-locked:${agencyId}`);
    return PUBLIC_VIEW;
  }
}

const STATE: AgencyDeliveryState = { deliveryActive: true, zones: [{ id: '00000000-0000-4000-8000-000000000501', city: 'Douala', district: 'Akwa', active: true }] };

class RecordingDelivery implements ReadAgencyDeliveryRepository {
  readonly calls: string[] = [];

  async activeRoleOf(agencyId: string, userId: string): Promise<AgencyRole | null> {
    this.calls.push(`role:${agencyId}:${userId}`);
    return userId === OWNER.user ? 'owner' : null;
  }

  async deliveryStateOf(agencyId: string): Promise<AgencyDeliveryState> {
    this.calls.push(`state:${agencyId}`);
    return STATE;
  }

  async deliveryStateOfLockedShared(agencyId: string): Promise<AgencyDeliveryState> {
    this.calls.push(`locked:${agencyId}`);
    return STATE;
  }
}

test('the reader answers the role of an active member and nothing for anyone else', async () => {
  const reader = new AgencyAccessReader(new RecordingDelivery(), new RecordingPublicView());
  assert.equal(await reader.activeRoleOf(AGENCY, OWNER.user), 'owner');
  assert.equal(await reader.activeRoleOf(AGENCY, '00000000-0000-4000-8000-0000000000aa'), null);
});

test('the shared lock is taken only by the variant that asks for it', async () => {
  const delivery = new RecordingDelivery();
  const reader = new AgencyAccessReader(delivery, new RecordingPublicView());
  assert.deepEqual(await reader.deliveryStateOf(AGENCY), STATE);
  assert.deepEqual(delivery.calls, [`state:${AGENCY}`]);
  assert.deepEqual(await reader.deliveryStateOfLockedShared(AGENCY), STATE);
  assert.deepEqual(delivery.calls, [`state:${AGENCY}`, `locked:${AGENCY}`]);
});

test('the public view is read without a lock, and with a shared lock only by the variant that asks for it', async () => {
  const view = new RecordingPublicView();
  const reader = new AgencyAccessReader(new RecordingDelivery(), view);
  assert.deepEqual(await reader.publicViewOf(AGENCY), PUBLIC_VIEW);
  assert.deepEqual(view.calls, [`view:${AGENCY}`]);
  assert.deepEqual(await reader.publicViewOfLockedShared(AGENCY), PUBLIC_VIEW);
  assert.deepEqual(view.calls, [`view:${AGENCY}`, `view-locked:${AGENCY}`]);
});
