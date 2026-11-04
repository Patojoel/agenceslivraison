import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ManualPrice } from '../../domain/value-objects/manual-price';
import { QuoteReference } from '../../domain/value-objects/quote-reference';
import { Recipient } from '../../domain/value-objects/recipient';

const invalid = (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'invalid';

test('a quote reference reads DEV-year-number on six digits, up to 999 999', () => {
  assert.equal(QuoteReference.of(2026, 1).value, 'DEV-2026-000001');
  assert.equal(QuoteReference.of(2026, 999_999).value, 'DEV-2026-999999');
  assert.throws(() => QuoteReference.of(2026, 1_000_000), invalid);
  assert.throws(() => QuoteReference.of(2026, 0), invalid);
  assert.throws(() => QuoteReference.of(2026, 1.5), invalid);
  assert.throws(() => QuoteReference.of(1999, 1), invalid);
});

test('a reference written by the system is read back, anything else is refused', () => {
  const reference = QuoteReference.parse('DEV-2026-000042');
  assert.deepEqual([reference.year, reference.number, reference.value], [2026, 42, 'DEV-2026-000042']);
  for (const bad of ['', 'DEV-2026-42', 'dev-2026-000042', 'DEV-2026-0000420', 'FAC-2026-000042']) assert.throws(() => QuoteReference.parse(bad), invalid, bad);
});

test('the name of a recipient has 2 to 120 characters once trimmed', () => {
  assert.throws(() => Recipient.of('J', null), invalid);
  assert.equal(Recipient.of('Jo', null).name, 'Jo');
  assert.equal(Recipient.of('  Jean Kamga  ', null).name, 'Jean Kamga');
  assert.equal(Recipient.of('é'.repeat(120), null).name.length, 120);
  assert.throws(() => Recipient.of('a'.repeat(121), null), invalid);
  assert.throws(() => Recipient.of('   ', null), invalid);
});

test('a recipient name holds no control, format or line break character', () => {
  for (const bad of ['Jean\u0000Kamga', 'Jean\nKamga', 'Jean‮Kamga', 'Jean​Kamga']) assert.throws(() => Recipient.of(bad, null), invalid, JSON.stringify(bad));
});

test('the phone of a recipient is optional and Cameroonian: +237 and nine digits starting with 2 or 6', () => {
  assert.equal(Recipient.of('Jean Kamga', null).phone, null);
  assert.equal(Recipient.of('Jean Kamga', '+237 699 00 11 22').phone, '+237699001122');
  assert.equal(Recipient.of('Jean Kamga', '699001122').phone, '+237699001122');
  assert.equal(Recipient.of('Jean Kamga', '+237222123456').phone, '+237222123456');
  for (const bad of ['+33612345678', '', '+23769900112', '+2377990011223', '+237 799001122', 'abc']) assert.throws(() => Recipient.of('Jean Kamga', bad), invalid, bad);
});

test('a manual price is a whole number of francs from 1 to 10 000 000 with a reason of 3 to 300 characters', () => {
  const manual = ManualPrice.of(2000, 'client régulier');
  assert.deepEqual([manual.price, manual.reason], [2000, 'client régulier']);
  assert.equal(ManualPrice.of(1, 'abc').price, 1);
  assert.equal(ManualPrice.of(10_000_000, 'a'.repeat(300)).price, 10_000_000);
  for (const price of [0, -1, 10_000_001, 1000.5, Number.NaN]) assert.throws(() => ManualPrice.of(price, 'client régulier'), invalid, String(price));
  for (const reason of ['', 'ab', '  ab  ', 'a'.repeat(301), 'gros\ncolis', 'gros\u0000colis']) assert.throws(() => ManualPrice.of(2000, reason), invalid, JSON.stringify(reason));
  assert.equal(ManualPrice.of(2000, '  gros colis  ').reason, 'gros colis');
});
