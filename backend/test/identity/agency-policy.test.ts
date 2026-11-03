import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageMembership } from '../../src/modules/identity/domain/agency-policy';

test('owner may manage others, but never change their own role', () => {
  assert.equal(canManageMembership('owner', 'agent', 'admin', false), true);
  assert.equal(canManageMembership('owner', 'owner', 'agent', false), true);
  assert.equal(canManageMembership('owner', 'owner', 'admin', true), false);
});
test('admin can manage only agents and cannot grant elevated roles', () => {
  assert.equal(canManageMembership('admin', 'agent', 'agent', false), true);
  assert.equal(canManageMembership('admin', 'agent', 'admin', false), false);
  assert.equal(canManageMembership('admin', 'admin', 'agent', false), false);
  assert.equal(canManageMembership('agent', 'agent', 'agent', false), false);
});
