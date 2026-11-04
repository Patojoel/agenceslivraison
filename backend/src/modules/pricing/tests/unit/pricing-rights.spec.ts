import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENCY_ROLES } from '@modules/agencies/application/queries/agency-access/agency-access.contract';
import { mayIssueQuotes, mayReadPricing, mayWriteRateCard } from '../../application/pricing-rights';

test('every role of an agency has an explicit answer for each pricing right', () => {
  for (const role of AGENCY_ROLES) {
    assert.equal(typeof mayWriteRateCard(role), 'boolean', role);
    assert.equal(typeof mayReadPricing(role), 'boolean', role);
    assert.equal(typeof mayIssueQuotes(role), 'boolean', role);
  }
});

test('owners and administrators write the rate card, every active member reads, simulates, issues and accepts quotes', () => {
  assert.deepEqual(AGENCY_ROLES.map(role => [role, mayWriteRateCard(role), mayReadPricing(role), mayIssueQuotes(role)]), [['owner', true, true, true], ['admin', true, true, true], ['agent', false, true, true]]);
});

test('a role that is not listed has no right at all, whatever its name', () => {
  for (const role of ['', 'superadmin', 'toString', '__proto__', 'constructor']) {
    // Only roles of the domain reach these functions; this guards the lookup against inherited properties.
    assert.equal(mayWriteRateCard(role as never), false, role);
    assert.equal(mayReadPricing(role as never), false, role);
    assert.equal(mayIssueQuotes(role as never), false, role);
  }
});
