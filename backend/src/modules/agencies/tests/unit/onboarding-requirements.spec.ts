import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOnboarding, OnboardingFacts } from '../../domain/onboarding-requirements';

const COMPLETE: OnboardingFacts = {
  status: 'draft',
  identity: { legalName: true, headquartersCity: true, headquartersAddress: true, primaryPhone: true },
  activeCapabilities: 1,
  activeSites: 1,
};

const missing = (facts: OnboardingFacts) => evaluateOnboarding(facts).prerequisites.filter(item => !item.filled).map(item => item.code);

test('a complete draft has every prerequisite filled and is ready for submission', () => {
  const result = evaluateOnboarding(COMPLETE);
  assert.equal(result.readyForSubmission, true);
  assert.deepEqual(result.prerequisites.map(item => item.code), [
    'legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site',
  ]);
  assert.ok(result.prerequisites.every(item => item.filled));
});

test('each missing element is reported on its own and blocks readiness', () => {
  const cases: [OnboardingFacts, string][] = [
    [{ ...COMPLETE, identity: { ...COMPLETE.identity, legalName: false } }, 'legal_name'],
    [{ ...COMPLETE, identity: { ...COMPLETE.identity, headquartersCity: false } }, 'headquarters_city'],
    [{ ...COMPLETE, identity: { ...COMPLETE.identity, headquartersAddress: false } }, 'headquarters_address'],
    [{ ...COMPLETE, identity: { ...COMPLETE.identity, primaryPhone: false } }, 'primary_phone'],
    [{ ...COMPLETE, activeCapabilities: 0 }, 'active_capability'],
    [{ ...COMPLETE, activeSites: 0 }, 'active_site'],
  ];
  for (const [facts, code] of cases) {
    assert.deepEqual(missing(facts), [code]);
    assert.equal(evaluateOnboarding(facts).readyForSubmission, false);
  }
});

test('all missing elements are listed together', () => {
  const facts: OnboardingFacts = { ...COMPLETE, identity: { ...COMPLETE.identity, primaryPhone: false }, activeSites: 0 };
  assert.deepEqual(missing(facts), ['primary_phone', 'active_site']);
});

test('a submitted agency is never ready for submission again', () => {
  assert.equal(evaluateOnboarding({ ...COMPLETE, status: 'submitted' }).readyForSubmission, false);
});
