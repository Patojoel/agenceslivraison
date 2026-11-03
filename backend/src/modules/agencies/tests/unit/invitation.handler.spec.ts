import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AcceptInvitationHandler } from '../../application/commands/accept-invitation/accept-invitation.handler';
import { IssueInvitationHandler } from '../../application/commands/issue-invitation/issue-invitation.handler';
import { AlreadyMember, InvitationNotFound, MembershipForbidden, MembershipNotFound } from '../../domain/exceptions/agency.exceptions';
import { INVITATION_LIFETIME_MS } from '../../domain/invitation';
import { DeterministicTokenSecrets, FixedClock, RecordingEventPublisher, SequentialIds, T0, tokenParts, uuid } from '@shared/tests/doubles/fakes';
import { ADMIN, AGENCY, AGENT, InMemoryAgencyTeamRepository, InMemoryInvitationRepository, membership, OTHER_AGENCY, OWNER } from '../doubles/fakes';

const INVITEE = { userId: uuid(7), email: 'invited@example.com' };

function setup() {
  const teams = new InMemoryAgencyTeamRepository(membership(OWNER, 'owner'), membership(ADMIN, 'admin'), membership(AGENT, 'agent'));
  const invitations = new InMemoryInvitationRepository();
  const secrets = new DeterministicTokenSecrets();
  const clock = new FixedClock();
  const ids = new SequentialIds();
  const events = new RecordingEventPublisher();
  return {
    teams, invitations, secrets, clock, events,
    issue: new IssueInvitationHandler(teams, invitations, secrets, ids, clock, events),
    accept: new AcceptInvitationHandler(invitations, teams, secrets, ids, clock, events),
  };
}

const invite = (handler: IssueInvitationHandler, actorId = OWNER.user, role: 'admin' | 'agent' = 'agent', agencyId = AGENCY) =>
  handler.handle({ actorId, agencyId, email: 'Invited@Example.com', role });

test('issuing returns a one-time token valid seven days and stores only its digest', async () => {
  const { invitations, secrets, events, issue } = setup();
  const result = await invite(issue);
  const [id, secret] = tokenParts(result.token);
  assert.equal(result.expiresAt, new Date(T0.getTime() + INVITATION_LIFETIME_MS).toISOString());
  const stored = invitations.stored(id);
  assert.equal(stored?.tokenDigest.value, secrets.digest(secret).value);
  assert.equal(stored?.email.value, 'invited@example.com');
  assert.deepEqual(events.published, [{ type: 'InvitationIssued', agencyId: AGENCY, actorId: OWNER.user }]);
});

test('only owners invite admins, owners and admins invite agents, outsiders are not told the agency exists', async () => {
  const { issue } = setup();
  await invite(issue, OWNER.user, 'admin');
  await invite(issue, ADMIN.user, 'agent');
  await assert.rejects(invite(issue, ADMIN.user, 'admin'), MembershipForbidden);
  await assert.rejects(invite(issue, AGENT.user, 'agent'), MembershipForbidden);
  await assert.rejects(invite(issue, OWNER.user, 'agent', OTHER_AGENCY), MembershipNotFound);
});

test('the invited account joins with the invited role, once', async () => {
  const { teams, invitations, events, issue, accept } = setup();
  const { token } = await invite(issue);
  assert.deepEqual(await accept.handle({ ...INVITEE, token }), { agencyId: AGENCY, role: 'agent' });
  const joined = teams.memberships().find(item => item.userId.value === INVITEE.userId);
  assert.equal(joined?.role, 'agent');
  assert.notEqual(invitations.stored(tokenParts(token)[0])?.acceptedAt, null);
  assert.deepEqual(events.types(), ['InvitationIssued', 'InvitationAccepted']);
  await assert.rejects(accept.handle({ ...INVITEE, token }), InvitationNotFound);
});

test('an invitation is not found for another email, a wrong secret, an unknown id or after expiry', async () => {
  const { clock, issue, accept } = setup();
  const { token } = await invite(issue);
  const [id] = tokenParts(token);
  await assert.rejects(accept.handle({ userId: OWNER.user, email: 'someone@example.com', token }), InvitationNotFound);
  await assert.rejects(accept.handle({ userId: uuid(8), email: null, token }), InvitationNotFound);
  await assert.rejects(accept.handle({ ...INVITEE, token: `${id}.${'x'.repeat(43)}` }), InvitationNotFound);
  await assert.rejects(accept.handle({ ...INVITEE, token: `${uuid(99)}.${'x'.repeat(43)}` }), InvitationNotFound);
  clock.advance(INVITATION_LIFETIME_MS);
  await assert.rejects(accept.handle({ ...INVITEE, token }), InvitationNotFound);
});

test('a current member cannot accept, and the invitation stays pending', async () => {
  const { invitations, events, issue, accept } = setup();
  const result = await issue.handle({ actorId: OWNER.user, agencyId: AGENCY, email: 'agent@example.com', role: 'agent' });
  await assert.rejects(accept.handle({ userId: AGENT.user, email: 'agent@example.com', token: result.token }), AlreadyMember);
  assert.equal(invitations.stored(tokenParts(result.token)[0])?.acceptedAt, null);
  assert.deepEqual(events.types(), ['InvitationIssued']);
});
