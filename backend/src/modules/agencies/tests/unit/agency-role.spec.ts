import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENCY_ROLES, AgencyRole, canInvite, canManage, managesAgencyIdentity, submitsAgency } from '../../domain/agency-role';

const EXPECTED: Readonly<Record<AgencyRole, { readonly configures: boolean; readonly submits: boolean; readonly invites: readonly AgencyRole[]; readonly manages: readonly AgencyRole[] }>> = {
  owner: { configures: true, submits: true, invites: ['admin', 'agent'], manages: ['owner', 'admin', 'agent'] },
  admin: { configures: true, submits: false, invites: ['agent'], manages: ['agent'] },
  agent: { configures: false, submits: false, invites: [], manages: [] },
};

test('the rights of every role are listed explicitly: a role that is not listed has no right', () => {
  assert.deepEqual(Object.keys(EXPECTED).sort(), [...AGENCY_ROLES].sort(), 'the expectation covers every role');
  for (const role of AGENCY_ROLES) {
    const expected = EXPECTED[role];
    assert.equal(managesAgencyIdentity(role), expected.configures, `${role} configures`);
    assert.equal(submitsAgency(role), expected.submits, `${role} submits`);
    for (const other of AGENCY_ROLES) {
      assert.equal(canInvite(role, other), expected.invites.includes(other), `${role} invites ${other}`);
      assert.equal(canManage(role, other), expected.manages.includes(other), `${role} manages ${other}`);
    }
  }
});

test('an unknown role has no right at all', () => {
  const unknown = 'auditor' as unknown as AgencyRole;
  assert.deepEqual([managesAgencyIdentity(unknown), submitsAgency(unknown), canInvite(unknown, 'agent'), canManage(unknown, 'agent')], [false, false, false, false]);
});
