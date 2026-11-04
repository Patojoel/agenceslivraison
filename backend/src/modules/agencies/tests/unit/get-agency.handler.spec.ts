import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetAgencyHandler } from '../../application/queries/get-agency/get-agency.handler';
import { AgencyReadModel } from '../../application/read-models/agency.read-model';
import { AgencyIdentityReadForbidden, AgencyNotFound } from '../../domain/exceptions/agency.exceptions';
import { ADMIN, AGENCY, AGENT, InMemoryReadAgencyRepository, OWNER } from '../doubles/fakes';

const ROW: AgencyReadModel = {
  id: AGENCY, status: 'draft', tradeName: 'Express Douala', description: null, version: 2,
  identity: { legalName: 'Express Douala SARL', headquartersCity: null, headquartersAddress: null, primaryPhone: '+237677123456', contactEmail: null, rccm: null, niu: null },
};

function handler(): GetAgencyHandler {
  return new GetAgencyHandler(new InMemoryReadAgencyRepository([
    [AGENCY, OWNER.user, 'owner', ROW],
    [AGENCY, ADMIN.user, 'admin', ROW],
    [AGENCY, AGENT.user, 'agent', ROW],
  ]));
}

test('the owner and an administrator read the agency with its version', async () => {
  assert.deepEqual(await handler().handle({ agencyId: AGENCY, userId: OWNER.user }), ROW);
  assert.deepEqual(await handler().handle({ agencyId: AGENCY, userId: ADMIN.user }), ROW);
});

test('an active agent is refused: forbidden, not not found, and nothing of the agency comes back', async () => {
  await assert.rejects(handler().handle({ agencyId: AGENCY, userId: AGENT.user }), (error: unknown) => {
    assert.ok(error instanceof AgencyIdentityReadForbidden);
    assert.equal(error.kind, 'forbidden');
    assert.ok(!JSON.stringify(error).includes('Express'));
    return true;
  });
});

test('someone who is not an active member, or an unknown agency, is answered not found', async () => {
  await assert.rejects(handler().handle({ agencyId: AGENCY, userId: '00000000-0000-4000-8000-0000000000aa' }), AgencyNotFound);
  await assert.rejects(handler().handle({ agencyId: '00000000-0000-4000-8000-0000000000bb', userId: OWNER.user }), AgencyNotFound);
});
