import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetAgencyHandler } from '../../application/queries/get-agency/get-agency.handler';
import { AgencyReadModel } from '../../application/read-models/agency.read-model';
import { AgencyNotFound } from '../../domain/exceptions/agency.exceptions';
import { AGENCY, InMemoryReadAgencyRepository, OWNER } from '../doubles/fakes';

const ROW: AgencyReadModel = {
  id: AGENCY, status: 'draft', tradeName: 'Express Douala', description: null, version: 2,
  identity: { legalName: 'Express Douala SARL', headquartersCity: null, headquartersAddress: null, primaryPhone: '+237677123456', contactEmail: null, rccm: null, niu: null },
};

test('a member reads the agency with its version', async () => {
  const handler = new GetAgencyHandler(new InMemoryReadAgencyRepository([[AGENCY, OWNER.user, ROW]]));
  assert.deepEqual(await handler.handle({ agencyId: AGENCY, userId: OWNER.user }), ROW);
});

test('someone who is not an active member, or an unknown agency, is answered not found', async () => {
  const handler = new GetAgencyHandler(new InMemoryReadAgencyRepository([[AGENCY, OWNER.user, ROW]]));
  await assert.rejects(handler.handle({ agencyId: AGENCY, userId: '00000000-0000-4000-8000-0000000000aa' }), AgencyNotFound);
  await assert.rejects(handler.handle({ agencyId: '00000000-0000-4000-8000-0000000000bb', userId: OWNER.user }), AgencyNotFound);
});
