import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeMembership, Membership, removeMembership, selectAgency } from '../../src/modules/agencies/domain/memberships';

const owner: Membership = { userId: 'user-a', agencyId: 'agency-a', role: 'owner', permissions: ['manage-members'], active: true };
const member: Membership = { userId: 'user-b', agencyId: 'agency-a', role: 'member', permissions: [], active: true };

test('active agency must belong to the authenticated user', () => {
  assert.equal(selectAgency('user-a', 'agency-a', [owner]).agencyId, 'agency-a');
  assert.throws(() => selectAgency('user-b', 'agency-a', [owner]), /membership/);
  assert.throws(() => selectAgency('user-a', 'agency-a', [{ ...owner, active: false }]), /membership/);
  assert.throws(() => selectAgency('user-a', 'agency-b', [owner]), /membership/);
});

test('a user cannot grant themselves new permissions or ownership', () => {
  assert.throws(() => changeMembership('user-b', member, { ...member, permissions: ['manage-members'] }, [owner, member]), /self/);
  assert.throws(() => changeMembership('user-b', member, { ...member, role: 'owner' }, [owner, member]), /self/);
  assert.throws(() => changeMembership('user-b', { ...member, active: false }, member, [owner, member]), /self/);
});

test('the final active owner cannot be removed or demoted', () => {
  assert.throws(() => removeMembership(owner, [owner, member]), /last owner/);
  assert.throws(() => changeMembership('user-b', owner, { ...owner, role: 'member' }, [owner, member]), /last owner/);
  assert.throws(() => removeMembership(owner, [owner, { ...owner, agencyId: 'other', userId: 'user-c' }]), /last owner/);
  assert.throws(() => removeMembership(owner, [owner, { ...owner, userId: 'user-c', active: false }]), /last owner/);
  assert.equal(removeMembership(owner, [owner, { ...owner, userId: 'user-c' }]).active, false);
});

test('membership identity cannot be reassigned in a role change', () => {
  assert.throws(() => changeMembership('user-a', member, { ...member, agencyId: 'other' }, [owner, member]), /identity/);
});
