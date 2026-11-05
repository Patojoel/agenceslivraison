import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENCY_ROLES } from '@modules/agencies/application/queries/agency-access/agency-access.contract';
import { mayPublishProfile, mayReadProfileState } from '../../application/marketplace-rights';

test('every role of an agency has an explicit answer for each marketplace right', () => {
  for (const role of AGENCY_ROLES) {
    assert.equal(typeof mayPublishProfile(role), 'boolean', role);
    assert.equal(typeof mayReadProfileState(role), 'boolean', role);
  }
});

test('the owner alone publishes and withdraws the profile, every active member reads its state', () => {
  assert.deepEqual(AGENCY_ROLES.map(role => [role, mayPublishProfile(role), mayReadProfileState(role)]), [['owner', true, true], ['admin', false, true], ['agent', false, true]]);
});

test('a role that is not listed has no right at all, whatever its name', () => {
  for (const role of ['', 'superadmin', 'toString', '__proto__', 'constructor']) {
    assert.equal(mayPublishProfile(role as never), false, role);
    assert.equal(mayReadProfileState(role as never), false, role);
  }
});
