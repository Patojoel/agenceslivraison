import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, T0, uuid } from '@shared/tests/doubles/fakes';
import { UserId } from '@shared/domain/value-objects/user-id';
import { Quote, QuoteIssueInput } from '../../domain/quote';
import { RateCard } from '../../domain/rate-card';
import { RateCardContent } from '../../domain/rate-card-content';
import { ZoneView } from '../../domain/zone-directory';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { ManualPrice } from '../../domain/value-objects/manual-price';
import { QuoteId } from '../../domain/value-objects/quote-id';
import { QuoteReference } from '../../domain/value-objects/quote-reference';
import { RateCardId } from '../../domain/value-objects/rate-card-id';
import { Recipient } from '../../domain/value-objects/recipient';
import { ZoneId } from '../../domain/value-objects/zone-id';

const AKWA = uuid(501);
const DEIDO = uuid(503);
const AGENCY = AgencyId.of(uuid(10));
const AGENT = UserId.of(uuid(3));
const ADMIN = UserId.of(uuid(2));
const everyZoneActive = { statusOf: () => 'active' as const };
const kindOf = (kind: string, code?: string) => (error: unknown) =>
  error instanceof Error && 'kind' in error && error.kind === kind && (code === undefined || ('extras' in error && typeof error.extras === 'object' && error.extras !== null && 'code' in error.extras && error.extras.code === code));

const akwa: ZoneView = { id: AKWA, city: 'Douala', district: 'Akwa', active: true };
const deido: ZoneView = { id: DEIDO, city: 'Douala', district: 'Deïdo', active: true };
const card = () => RateCard.create({
  id: RateCardId.of(uuid(700)), agencyId: AGENCY, zones: everyZoneActive, authorId: ADMIN, now: T0,
  content: RateCardContent.of(null, [{ zoneId: AKWA, tiers: [{ upTo: '1 kg', price: 1000 }, { upTo: '5 kg', price: 1500 }, { upTo: '30 kg', price: 5000 }] }]),
});
const parcels = [{ weight: '0,8 kg', dimensions: null }, { weight: '3 kg', dimensions: null }];
const NOW = new Date('2026-11-10T09:00:00.000Z');

function input(overrides: Partial<QuoteIssueInput> = {}): QuoteIssueInput {
  return {
    id: QuoteId.of(uuid(800)), agencyId: AGENCY, reference: QuoteReference.of(2026, 1), recipient: Recipient.of('Jean Kamga', '+237699001122'),
    zone: akwa, deliveryActive: true, rateCard: card(), parcels, manual: null, issuedBy: AGENT, now: NOW, ...overrides,
  };
}
const issued = (overrides: Partial<QuoteIssueInput> = {}) => Quote.issue(input(overrides));
const accept = (zone: ZoneView | null = akwa, deliveryActive = true, now = new Date(NOW.getTime() + 2 * DAY)) => ({ actorId: ADMIN, now, zone, deliveryActive });

test('issuing a quote freezes the calculation: version, zone label, parcels, prices, total, validity', () => {
  const quote = issued();
  assert.deepEqual(quote.snapshot(), {
    id: QuoteId.of(uuid(800)), agencyId: AGENCY, reference: QuoteReference.of(2026, 1), recipient: Recipient.of('Jean Kamga', '+237699001122'),
    zone: { id: ZoneId.of(AKWA), city: 'Douala', district: 'Akwa' },
    parcels: [
      { weightGrams: 800, dimensions: null, taxableGrams: 800, price: 1000 },
      { weightGrams: 3000, dimensions: null, taxableGrams: 3000, price: 1500 },
    ],
    rateCardVersion: 1, pricing: 'priced', calculatedTotal: 2500, manual: null, total: 2500,
    issuedAt: NOW, issuedBy: AGENT, validUntil: new Date('2026-11-17T09:00:00.000Z'), status: 'issued', acceptedAt: null, acceptedBy: null,
  });
});

test('the quote carries exactly the total of the simulation', () => {
  const rateCard = card();
  const simulated = rateCard.quote(AKWA, parcels);
  assert.equal(simulated.status === 'priced' ? simulated.total : null, issued({ rateCard }).snapshot().total);
});

test('the dimensions of a parcel are kept with it, and weigh in the taxable weight', () => {
  const withDivisor = RateCard.create({
    id: RateCardId.of(uuid(700)), agencyId: AGENCY, zones: everyZoneActive, authorId: ADMIN, now: T0,
    content: RateCardContent.of(5000, [{ zoneId: AKWA, tiers: [{ upTo: '1 kg', price: 1000 }, { upTo: '5 kg', price: 1500 }] }]),
  });
  const quote = issued({ rateCard: withDivisor, parcels: [{ weight: '0,5 kg', dimensions: { length: 30, width: 20, height: 10 } }] });
  assert.deepEqual(quote.snapshot().parcels, [{ weightGrams: 500, dimensions: { length: 30, width: 20, height: 10 }, taxableGrams: 1200, price: 1500 }]);
});

test('issuing records QuoteIssued with identifiers only: no name, phone or amount', () => {
  const quote = issued();
  assert.deepEqual(quote.pullEvents(), [{ type: 'QuoteIssued', agencyId: AGENCY.value, quoteId: uuid(800), actorId: AGENT.value }]);
  assert.deepEqual(quote.pullEvents(), []);
});

test('a quote is issued until its validity date included, then expired; accepted stays accepted', () => {
  const quote = issued();
  const until = quote.snapshot().validUntil;
  assert.deepEqual([quote.stateAt(NOW), quote.stateAt(until), quote.stateAt(new Date(until.getTime() + 1))], ['issued', 'issued', 'expired']);
  quote.accept(accept(akwa, true, until));
  assert.equal(quote.stateAt(new Date(until.getTime() + DAY)), 'accepted');
});

test('a negotiated price is kept with its reason, and so is the calculation', () => {
  const snapshot = issued({ manual: ManualPrice.of(2000, 'client régulier') }).snapshot();
  assert.deepEqual([snapshot.calculatedTotal, snapshot.total, snapshot.pricing], [2500, 2000, 'priced']);
  assert.deepEqual([snapshot.manual?.price, snapshot.manual?.reason], [2000, 'client régulier']);
});

test('a parcel out of the scale can be priced by hand: the quote says it was out of the scale', () => {
  const snapshot = issued({ parcels: [{ weight: '31 kg', dimensions: null }], manual: ManualPrice.of(7000, 'gros colis') }).snapshot();
  assert.deepEqual([snapshot.pricing, snapshot.calculatedTotal, snapshot.total, snapshot.parcels], ['out_of_scale', null, 7000, [{ weightGrams: 31000, dimensions: null, taxableGrams: 31000, price: null }]]);
});

test('a zone without tariff, or an agency without rate card, can be priced by hand and keeps no calculation', () => {
  const noTariff = issued({ zone: deido, manual: ManualPrice.of(1800, 'zone proche') }).snapshot();
  assert.deepEqual([noTariff.pricing, noTariff.rateCardVersion, noTariff.calculatedTotal, noTariff.total, noTariff.parcels.map(parcel => parcel.price)], ['no_tariff', 1, null, 1800, [null, null]]);
  const noCard = issued({ rateCard: null, manual: ManualPrice.of(1800, 'zone proche') }).snapshot();
  assert.deepEqual([noCard.pricing, noCard.rateCardVersion, noCard.total], ['no_tariff', null, 1800]);
});

test('without a price that can be calculated and without a manual price, nothing is issued', () => {
  const notPriceable = kindOf('invalid', 'QUOTE_NOT_PRICEABLE');
  assert.throws(() => issued({ parcels: [{ weight: '31 kg', dimensions: null }] }), notPriceable);
  assert.throws(() => issued({ zone: deido }), notPriceable);
  assert.throws(() => issued({ rateCard: null }), notPriceable);
});

test('the parcels of a quote are read like the simulation reads them', () => {
  assert.throws(() => issued({ parcels: [] }), kindOf('invalid'));
  assert.throws(() => issued({ parcels: [{ weight: '5', dimensions: null }] }), kindOf('invalid'));
});

test('an unknown zone is not found, a retired zone and a delivery that is not active are conflicts, in that order', () => {
  assert.throws(() => issued({ zone: null, deliveryActive: false }), kindOf('not_found'));
  assert.throws(() => issued({ zone: { ...akwa, active: false }, deliveryActive: false }), kindOf('conflict', 'ZONE_RETIRED'));
  assert.throws(() => issued({ deliveryActive: false }), kindOf('conflict', 'DELIVERY_NOT_ACTIVE'));
});

test('accepting records who, when, and QuoteAccepted; the price does not move', () => {
  const quote = issued();
  quote.pullEvents();
  const at = new Date('2026-11-12T10:00:00.000Z');
  quote.accept({ actorId: ADMIN, now: at, zone: akwa, deliveryActive: true });
  const snapshot = quote.snapshot();
  assert.deepEqual([snapshot.status, snapshot.acceptedAt, snapshot.acceptedBy, snapshot.total, snapshot.rateCardVersion], ['accepted', at, ADMIN, 2500, 1]);
  assert.deepEqual(quote.pullEvents(), [{ type: 'QuoteAccepted', agencyId: AGENCY.value, quoteId: uuid(800), actorId: ADMIN.value }]);
});

test('a quote is accepted once: the second acceptance is a conflict, changes nothing and records nothing', () => {
  const quote = issued();
  quote.accept(accept());
  quote.pullEvents();
  const before = quote.snapshot();
  assert.throws(() => quote.accept({ ...accept(), actorId: AGENT }), kindOf('conflict', 'QUOTE_ALREADY_ACCEPTED'));
  assert.deepEqual(quote.snapshot(), before);
  assert.deepEqual(quote.pullEvents(), []);
});

test('an accepted quote answers "already accepted" even after its validity date', () => {
  const quote = issued();
  quote.accept(accept());
  assert.throws(() => quote.accept(accept(akwa, true, new Date(NOW.getTime() + 30 * DAY))), kindOf('conflict', 'QUOTE_ALREADY_ACCEPTED'));
});

test('a quote can be accepted at the very moment its validity ends, not one millisecond later', () => {
  const until = issued().snapshot().validUntil;
  const onTime = issued();
  onTime.accept(accept(akwa, true, until));
  assert.equal(onTime.snapshot().status, 'accepted');
  const late = issued();
  late.pullEvents();
  assert.throws(() => late.accept(accept(akwa, true, new Date(until.getTime() + 1))), kindOf('conflict', 'QUOTE_EXPIRED'));
  assert.equal(late.snapshot().status, 'issued');
  assert.deepEqual(late.pullEvents(), []);
});

test('a quote is not accepted when its zone was retired or the delivery is no longer active, and stays issued', () => {
  const quote = issued();
  assert.throws(() => quote.accept(accept({ ...akwa, active: false })), kindOf('conflict', 'ZONE_RETIRED'));
  assert.throws(() => quote.accept(accept(null)), kindOf('not_found'));
  assert.throws(() => quote.accept(accept(akwa, false)), kindOf('conflict', 'DELIVERY_NOT_ACTIVE'));
  assert.equal(quote.snapshot().status, 'issued');
});

test('a new version of the rate card never changes a quote already issued or accepted', () => {
  const rateCard = card();
  const quote = issued({ rateCard });
  quote.accept(accept());
  const before = quote.snapshot();
  const published = rateCard.publish({
    basedOn: 1, zones: everyZoneActive, authorId: ADMIN, now: new Date(NOW.getTime() + DAY),
    content: RateCardContent.of(null, [{ zoneId: AKWA, tiers: [{ upTo: '1 kg', price: 1200 }, { upTo: '5 kg', price: 1500 }] }]),
  });
  assert.equal(published, true);
  assert.deepEqual(quote.snapshot(), before);
  const later = issued({ rateCard, reference: QuoteReference.of(2026, 2) }).snapshot();
  assert.deepEqual([later.rateCardVersion, later.total], [2, 2700], 'whereas a quote issued afterwards uses version 2');
});

test('a reconstituted quote is the quote that was snapshotted', () => {
  const quote = issued();
  quote.accept(accept());
  assert.deepEqual(Quote.reconstitute(quote.snapshot()).snapshot(), quote.snapshot());
  assert.deepEqual(Quote.reconstitute(quote.snapshot()).pullEvents(), []);
});
