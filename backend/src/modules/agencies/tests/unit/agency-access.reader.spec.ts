import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadAgencyDeliveryRepository } from '../../application/ports/read-agency-delivery.repository';
import { AgencyAccessReader } from '../../application/queries/agency-access/agency-access.reader';
import { AgencyDeliveryState } from '../../application/read-models/agency-delivery.read-model';
import { AgencyRole } from '../../domain/agency-role';
import { AGENCY, OWNER } from '../doubles/fakes';

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
  const reader = new AgencyAccessReader(new RecordingDelivery());
  assert.equal(await reader.activeRoleOf(AGENCY, OWNER.user), 'owner');
  assert.equal(await reader.activeRoleOf(AGENCY, '00000000-0000-4000-8000-0000000000aa'), null);
});

test('the shared lock is taken only by the variant that asks for it', async () => {
  const delivery = new RecordingDelivery();
  const reader = new AgencyAccessReader(delivery);
  assert.deepEqual(await reader.deliveryStateOf(AGENCY), STATE);
  assert.deepEqual(delivery.calls, [`state:${AGENCY}`]);
  assert.deepEqual(await reader.deliveryStateOfLockedShared(AGENCY), STATE);
  assert.deepEqual(delivery.calls, [`state:${AGENCY}`, `locked:${AGENCY}`]);
});
