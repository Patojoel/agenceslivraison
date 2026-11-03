import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AlreadyMember, MembershipForbidden, MembershipNotFound } from '../../domain/exceptions/agency.exceptions';
import { MembershipId } from '../../domain/value-objects/membership-id';
import { at, uuid } from '@shared/tests/doubles/fakes';
import { ADMIN, AGENCY, AGENT, membership, OWNER, team } from '../doubles/fakes';

const user = (member: { user: string }) => UserId.of(member.user);
const id = (member: { membership: string }) => MembershipId.of(member.membership);
const SECOND_OWNER = { user: uuid(4), membership: uuid(24) };
const SECOND_AGENT = { user: uuid(5), membership: uuid(25) };

test('an owner manages any other member, including other owners', () => {
  const agency = team(membership(OWNER, 'owner'), membership(SECOND_OWNER, 'owner'), membership(AGENT, 'agent'));
  agency.changeRole(user(OWNER), id(AGENT), 'admin');
  agency.changeRole(user(OWNER), id(SECOND_OWNER), 'agent');
  assert.deepEqual(agency.snapshot().map(item => item.role), ['owner', 'agent', 'admin']);
  assert.deepEqual(agency.pullEvents().map(event => event.type), ['MembershipRoleChanged', 'MembershipRoleChanged']);
});

test('an admin manages only agents, and only as agents', () => {
  const agency = team(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'), membership(SECOND_AGENT, 'agent'));
  agency.changeRole(user(ADMIN), id(AGENT), 'agent');
  agency.revoke(user(ADMIN), id(SECOND_AGENT));
  assert.throws(() => agency.changeRole(user(ADMIN), id(AGENT), 'admin'), MembershipForbidden);
  assert.throws(() => agency.changeRole(user(ADMIN), id(OWNER), 'agent'), MembershipForbidden);
  assert.throws(() => agency.revoke(user(ADMIN), id(OWNER)), MembershipForbidden);
});

test('an agent manages nobody', () => {
  const agency = team(membership(OWNER, 'owner'), membership(AGENT, 'agent'), membership(SECOND_AGENT, 'agent'));
  assert.throws(() => agency.changeRole(user(AGENT), id(SECOND_AGENT), 'agent'), MembershipForbidden);
  assert.throws(() => agency.revoke(user(AGENT), id(SECOND_AGENT)), MembershipForbidden);
});

test('nobody changes or removes their own access', () => {
  const agency = team(membership(OWNER, 'owner'), membership(SECOND_OWNER, 'owner'));
  assert.throws(() => agency.changeRole(user(OWNER), id(OWNER), 'admin'), MembershipForbidden);
  assert.throws(() => agency.revoke(user(OWNER), id(OWNER)), MembershipForbidden);
});

test('an agency always keeps at least one active owner', () => {
  const agency = team(membership(OWNER, 'owner'), membership(SECOND_OWNER, 'owner'), membership(ADMIN, 'admin'));
  agency.revoke(user(OWNER), id(SECOND_OWNER));
  assert.throws(() => agency.revoke(user(SECOND_OWNER), id(OWNER)), MembershipNotFound);
  assert.throws(() => agency.revoke(user(OWNER), id(OWNER)), MembershipForbidden);
  assert.throws(() => agency.changeRole(user(OWNER), id(OWNER), 'agent'), MembershipForbidden);
  assert.throws(() => agency.revoke(user(ADMIN), id(OWNER)), MembershipForbidden);
  assert.deepEqual(agency.snapshot().filter(item => item.active && item.role === 'owner').map(item => item.userId.value), [OWNER.user]);
});

test('promoting to owner and keeping an owner role never trips the last-owner guard', () => {
  const agency = team(membership(OWNER, 'owner'), membership(SECOND_OWNER, 'owner'), membership(ADMIN, 'admin'));
  agency.changeRole(user(OWNER), id(ADMIN), 'owner');
  agency.changeRole(user(OWNER), id(SECOND_OWNER), 'owner');
  assert.equal(agency.snapshot().filter(item => item.role === 'owner').length, 3);
});

test('actors and targets outside the active team are not found', () => {
  const agency = team(membership(OWNER, 'owner'), membership(AGENT, 'agent', false));
  assert.throws(() => agency.changeRole(user(ADMIN), id(OWNER), 'agent'), MembershipNotFound);
  assert.throws(() => agency.revoke(user(OWNER), id(AGENT)), MembershipNotFound);
  assert.throws(() => agency.authorizeInvitation(user(AGENT), 'agent'), MembershipNotFound);
});

test('revocation deactivates the membership and records who did it', () => {
  const agency = team(membership(OWNER, 'owner'), membership(AGENT, 'agent'));
  agency.revoke(user(OWNER), id(AGENT));
  assert.equal(at(agency.snapshot(), 1).active, false);
  assert.deepEqual(agency.pullEvents(), [{ type: 'MembershipRevoked', agencyId: AGENCY, actorId: OWNER.user, subjectUserId: AGENT.user }]);
});

test('owners invite admins and agents, admins invite agents only, agents invite nobody', () => {
  const agency = team(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'));
  agency.authorizeInvitation(user(OWNER), 'admin');
  agency.authorizeInvitation(user(OWNER), 'agent');
  agency.authorizeInvitation(user(ADMIN), 'agent');
  assert.throws(() => agency.authorizeInvitation(user(ADMIN), 'admin'), MembershipForbidden);
  assert.throws(() => agency.authorizeInvitation(user(AGENT), 'agent'), MembershipForbidden);
});

test('admission refuses current and former members', () => {
  const agency = team(membership(OWNER, 'owner'), membership(AGENT, 'agent', false));
  assert.throws(() => agency.admit(MembershipId.of(uuid(30)), user(OWNER), 'agent'), AlreadyMember);
  assert.throws(() => agency.admit(MembershipId.of(uuid(30)), user(AGENT), 'agent'), AlreadyMember);
  agency.admit(MembershipId.of(uuid(30)), user(ADMIN), 'admin');
  assert.deepEqual(agency.snapshot()[2], membership({ user: ADMIN.user, membership: uuid(30) }, 'admin'));
});
