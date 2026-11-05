import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublishable, obstaclesOf } from '../../domain/publication-rules';
import { AgencyNotSubmitted, NoActiveCapability, ProvisionalTradeName, TradeNameNotPublishable } from '../../domain/exceptions/marketplace.exceptions';
import { AGENCY, view } from '../doubles/fakes';

test('a submitted agency with a proper name and an active capability has no obstacle', () => {
  assert.deepEqual(obstaclesOf(AGENCY, view()), []);
  assertPublishable(AGENCY, view());
});

test('a draft is not publishable', () => {
  assert.deepEqual(obstaclesOf(AGENCY, view({ submitted: false })), ['agency_not_submitted']);
  assert.throws(() => assertPublishable(AGENCY, view({ submitted: false })), AgencyNotSubmitted);
});

test('an agency without any active capability is not publishable', () => {
  assert.deepEqual(obstaclesOf(AGENCY, view({ capabilities: [] })), ['no_active_capability']);
  assert.throws(() => assertPublishable(AGENCY, view({ capabilities: [] })), NoActiveCapability);
});

test('invisible, bidirectional and control characters make a name unpublishable', () => {
  for (const char of ['‮', '​', '‍', '﻿', '\u0000', '­']) {
    const name = `Express${char}Douala`;
    assert.deepEqual(obstaclesOf(AGENCY, view({ tradeName: name })), ['trade_name_not_publishable'], JSON.stringify(char));
    assert.throws(() => assertPublishable(AGENCY, view({ tradeName: name })), TradeNameNotPublishable);
  }
});

test('a name from which no address can be made is not publishable', () => {
  assert.deepEqual(obstaclesOf(AGENCY, view({ tradeName: '!!' })), ['trade_name_not_publishable']);
});

test('the provisional name of the migration is not publishable, for that agency only', () => {
  const provisional = `Agence ${AGENCY.slice(0, 8)}`;
  assert.deepEqual(obstaclesOf(AGENCY, view({ tradeName: provisional })), ['provisional_trade_name']);
  assert.throws(() => assertPublishable(AGENCY, view({ tradeName: provisional })), ProvisionalTradeName);
  assert.deepEqual(obstaclesOf('11111111-1111-4111-8111-111111111111', view({ tradeName: provisional })), []);
});

test('every obstacle is listed, and the first one in the order of the specification is thrown', () => {
  const all = view({ submitted: false, capabilities: [], tradeName: `Agence ${AGENCY.slice(0, 8)}` });
  assert.deepEqual(obstaclesOf(AGENCY, all), ['agency_not_submitted', 'provisional_trade_name', 'no_active_capability']);
  assert.throws(() => assertPublishable(AGENCY, all), AgencyNotSubmitted);
});
