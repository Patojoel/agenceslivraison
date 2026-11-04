import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GetAgencyOnboardingHandler } from '../../application/queries/get-agency-onboarding/get-agency-onboarding.handler';
import { AgencyOnboardingReadModel } from '../../application/read-models/agency-onboarding.read-model';
import { AgencyNotFound } from '../../domain/exceptions/agency.exceptions';
import { uuid } from '@shared/tests/doubles/fakes';
import { AGENCY, InMemoryReadAgencyOnboardingRepository, OWNER } from '../doubles/fakes';

const DRAFT: AgencyOnboardingReadModel = {
  status: 'draft',
  submission: null,
  identity: { legalName: false, headquartersCity: false, headquartersAddress: false, primaryPhone: false },
  capabilities: [],
  activeSites: 0,
  activeZones: 0,
};

const handlerWith = (...rows: [string, string, AgencyOnboardingReadModel][]) =>
  new GetAgencyOnboardingHandler(new InMemoryReadAgencyOnboardingRepository(rows));

test('a new draft lists every prerequisite as missing and is not ready', async () => {
  const state = await handlerWith([AGENCY, OWNER.user, DRAFT]).handle({ agencyId: AGENCY, userId: OWNER.user });
  assert.equal(state.status, 'draft');
  assert.equal(state.submission, null);
  assert.equal(state.readyForSubmission, false);
  assert.equal(state.hybrid, false);
  assert.deepEqual([state.activeZones, state.activeSites, state.capabilities], [0, 0, []]);
  assert.deepEqual(state.prerequisites.map(item => item.filled), [false, false, false, false, false, false]);
});

test('the state reports filled prerequisites without any identity value, and readiness once all are filled', async () => {
  const complete: AgencyOnboardingReadModel = {
    ...DRAFT,
    identity: { legalName: true, headquartersCity: true, headquartersAddress: true, primaryPhone: true },
    capabilities: [{ type: 'delivery', state: 'active', since: '2026-11-04T00:00:00.000Z', reason: null, acceptsNewRequests: true }],
    activeSites: 1,
    activeZones: 2,
  };
  const state = await handlerWith([AGENCY, OWNER.user, complete]).handle({ agencyId: AGENCY, userId: OWNER.user });
  assert.equal(state.readyForSubmission, true);
  assert.equal(state.activeZones, 2);
  assert.deepEqual(Object.keys(state).sort(), ['activeSites', 'activeZones', 'capabilities', 'hybrid', 'prerequisites', 'readyForSubmission', 'status', 'submission']);
});

test('an agency is hybrid only while both capabilities are active', async () => {
  const both = (storage: 'active' | 'suspended'): AgencyOnboardingReadModel => ({
    ...DRAFT,
    capabilities: [
      { type: 'delivery', state: 'active', since: '2026-11-04T00:00:00.000Z', reason: null, acceptsNewRequests: true },
      { type: 'storage', state: storage, since: '2026-11-04T00:00:00.000Z', reason: storage === 'suspended' ? 'Manque de place' : null, acceptsNewRequests: storage === 'active' },
    ],
  });
  assert.equal((await handlerWith([AGENCY, OWNER.user, both('active')]).handle({ agencyId: AGENCY, userId: OWNER.user })).hybrid, true);
  assert.equal((await handlerWith([AGENCY, OWNER.user, both('suspended')]).handle({ agencyId: AGENCY, userId: OWNER.user })).hybrid, false);
});

test('a submitted agency is presented as submitted and never as ready', async () => {
  const submitted: AgencyOnboardingReadModel = { ...DRAFT, status: 'submitted', submission: { submittedAt: '2026-11-15T00:00:00.000Z', submittedBy: OWNER.user } };
  const state = await handlerWith([AGENCY, OWNER.user, submitted]).handle({ agencyId: AGENCY, userId: OWNER.user });
  assert.equal(state.status, 'submitted');
  assert.deepEqual(state.submission, { submittedAt: '2026-11-15T00:00:00.000Z', submittedBy: OWNER.user });
  assert.equal(state.readyForSubmission, false);
});

test('a person without an active membership finds nothing, like an unknown agency', async () => {
  const handler = handlerWith([AGENCY, OWNER.user, DRAFT]);
  await assert.rejects(handler.handle({ agencyId: AGENCY, userId: uuid(99) }), AgencyNotFound);
  await assert.rejects(handler.handle({ agencyId: uuid(98), userId: OWNER.user }), AgencyNotFound);
});
