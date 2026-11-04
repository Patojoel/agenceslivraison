import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uuid } from '@shared/tests/doubles/fakes';
import { ListAgencyMembersHandler } from '../../application/queries/list-agency-members/list-agency-members.handler';
import { AgencyNotFound } from '../../domain/exceptions/agency.exceptions';
import { ADMIN, AGENCY, AGENT, InMemoryReadAgencyMemberRepository, OTHER_AGENCY, OWNER } from '../doubles/fakes';

const FORMER = { user: uuid(4), membership: uuid(24) };
const OUTSIDER = uuid(5);

const members = new InMemoryReadAgencyMemberRepository([
  { agencyId: AGENCY, membershipId: OWNER.membership, userId: OWNER.user, role: 'owner', active: true },
  { agencyId: AGENCY, membershipId: ADMIN.membership, userId: ADMIN.user, role: 'admin', active: true },
  { agencyId: AGENCY, membershipId: AGENT.membership, userId: AGENT.user, role: 'agent', active: true },
  { agencyId: AGENCY, membershipId: FORMER.membership, userId: FORMER.user, role: 'admin', active: false },
  { agencyId: OTHER_AGENCY, membershipId: uuid(26), userId: uuid(6), role: 'owner', active: true },
]);
const handler = new ListAgencyMembersHandler(members);

test('every active member, whatever the role, lists the active members with membership, user and role only', async () => {
  for (const reader of [OWNER, ADMIN, AGENT]) {
    const page = await handler.handle({ agencyId: AGENCY, userId: reader.user, limit: 20, cursor: null });
    assert.deepEqual(page.items, [
      { membershipId: OWNER.membership, userId: OWNER.user, role: 'owner' },
      { membershipId: ADMIN.membership, userId: ADMIN.user, role: 'admin' },
      { membershipId: AGENT.membership, userId: AGENT.user, role: 'agent' },
    ]);
    assert.deepEqual([page.hasMore, page.nextCursor], [false, null]);
  }
});

test('the list is paged by cursor on the membership identifier', async () => {
  const first = await handler.handle({ agencyId: AGENCY, userId: OWNER.user, limit: 2, cursor: null });
  assert.deepEqual([first.items.length, first.hasMore, first.nextCursor], [2, true, ADMIN.membership]);
  const second = await handler.handle({ agencyId: AGENCY, userId: OWNER.user, limit: 2, cursor: first.nextCursor });
  assert.deepEqual([second.items.map(item => item.membershipId), second.hasMore, second.nextCursor], [[AGENT.membership], false, null]);
});

test('an outsider, a former member and the member of another agency get the same not found, even with a cursor', async () => {
  for (const userId of [OUTSIDER, FORMER.user, uuid(6)]) {
    await assert.rejects(handler.handle({ agencyId: AGENCY, userId, limit: 20, cursor: null }), AgencyNotFound);
    await assert.rejects(handler.handle({ agencyId: AGENCY, userId, limit: 20, cursor: OWNER.membership }), AgencyNotFound);
  }
  await assert.rejects(handler.handle({ agencyId: uuid(99), userId: OWNER.user, limit: 20, cursor: null }), AgencyNotFound);
});

test('a member who reads beyond the last row gets an empty page, not a not found', async () => {
  const page = await handler.handle({ agencyId: AGENCY, userId: OWNER.user, limit: 20, cursor: AGENT.membership });
  assert.deepEqual([page.items, page.hasMore, page.nextCursor], [[], false, null]);
});
