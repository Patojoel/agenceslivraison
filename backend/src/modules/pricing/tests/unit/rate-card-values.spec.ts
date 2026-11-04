import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dimensions } from '../../domain/value-objects/dimensions';
import { Price } from '../../domain/value-objects/price';
import { VolumetricDivisor } from '../../domain/value-objects/volumetric-divisor';
import { Weight } from '../../domain/value-objects/weight';

const invalid = (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'invalid';

test('a bound is read with its explicit unit, to the gram', () => {
  assert.equal(Weight.bound('1 kg').grams, 1000);
  assert.equal(Weight.bound('1000 g').grams, 1000);
  assert.equal(Weight.bound('1,0 kg').grams, 1000);
  assert.equal(Weight.bound('1.0 kg').grams, 1000);
  assert.equal(Weight.bound(' 1kg ').grams, 1000);
  assert.equal(Weight.bound('0,999 kg').grams, 999);
  assert.equal(Weight.bound('0,001 kg').grams, 1);
  assert.equal(Weight.bound('1000 kg').grams, 1_000_000);
});

test('a bound without unit, with another unit, finer than the gram or out of range is invalid', () => {
  for (const raw of ['1', '1 lb', '1 kilo', '0,5 g', '1001 kg', '0 kg', '0 g', '-1 kg', '', 'kg', '1,0005 kg', '1 kg 2', '1e3 g', `${'1'.repeat(40)} kg`]) {
    assert.throws(() => Weight.bound(raw), invalid, raw);
  }
});

test('a measured weight is rounded up to the gram but keeps the same bounds', () => {
  assert.equal(Weight.measured('0,0004 kg').grams, 1);
  assert.equal(Weight.measured('0,5 g').grams, 1);
  assert.equal(Weight.measured('2 kg').grams, 2000);
  assert.equal(Weight.measured('1000 kg').grams, 1_000_000);
  for (const raw of ['2', '2 lb', '0 kg', '-1 kg', '1001 kg', '1000,0001 kg']) assert.throws(() => Weight.measured(raw), invalid, raw);
});

test('a price is a whole number of francs from 1 to 10 000 000', () => {
  assert.equal(Price.of(1).value, 1);
  assert.equal(Price.of(10_000_000).value, 10_000_000);
  for (const value of [0, -500, 1000.5, 10_000_001, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) assert.throws(() => Price.of(value), invalid, String(value));
});

test('the volumetric divisor is a whole number from 1 000 to 10 000', () => {
  for (const value of [1000, 5000, 10_000]) assert.equal(VolumetricDivisor.of(value).value, value);
  for (const value of [999, 10_001, 5000.5, Number.NaN]) assert.throws(() => VolumetricDivisor.of(value), invalid, String(value));
});

test('dimensions are three whole centimetres from 1 to 500', () => {
  assert.equal(Dimensions.of(30, 20, 10).volume, 6000);
  assert.equal(Dimensions.of(500, 500, 500).volume, 125_000_000);
  for (const [l, w, h] of [[0, 1, 1], [1, 501, 1], [1, 1, -1], [1.5, 1, 1], [Number.NaN, 1, 1]] as const) assert.throws(() => Dimensions.of(l, w, h), invalid, `${l} ${w} ${h}`);
});
