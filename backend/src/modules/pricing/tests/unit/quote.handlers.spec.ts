import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, FixedClock, InMemoryAuditLog, InMemoryIdempotencyKeys, RecordingEventPublisher, SequentialIds, T0, uuid } from '@shared/tests/doubles/fakes';
import { AcceptQuoteHandler } from '../../application/commands/accept-quote/accept-quote.handler';
import { CreateRateCardHandler } from '../../application/commands/create-rate-card/create-rate-card.handler';
import { IssueQuoteCommand } from '../../application/commands/issue-quote/issue-quote.command';
import { IssueQuoteHandler } from '../../application/commands/issue-quote/issue-quote.handler';
import { GetQuoteHandler } from '../../application/queries/get-quote/get-quote.handler';
import { ListQuotesHandler } from '../../application/queries/list-quotes/list-quotes.handler';
import { decodeQuoteCursor } from '../../application/queries/list-quotes/quote-cursor';
import { PreviewQuoteHandler } from '../../application/queries/preview-quote/preview-quote.handler';
import { PricingAuditSubscriber } from '../../application/subscribers/pricing-audit.subscriber';
import { ADMIN, AGENCY, AGENT, AKWA, BONABERI, DEIDO, DELIVERY_ZONES, FakeAgencyAccess, FOREIGN_ZONE, FORMER, InMemoryQuoteStore, InMemoryRateCardStore, OTHER_AGENCY, OTHER_OWNER, OUTSIDER, OWNER, RETIRED_ZONE, scale } from '../doubles/fakes';

const kindOf = (kind: string, code?: string) => (error: unknown) =>
  error instanceof Error && 'kind' in error && error.kind === kind && (code === undefined || ('extras' in error && typeof error.extras === 'object' && error.extras !== null && 'code' in error.extras && error.extras.code === code));
const parcel = (weight: string) => ({ weight, dimensions: null });

async function setup(withCard = true) {
  const access = new FakeAgencyAccess();
  const rateCards = new InMemoryRateCardStore();
  const quotes = new InMemoryQuoteStore();
  const idempotency = new InMemoryIdempotencyKeys();
  const events = new RecordingEventPublisher();
  const clock = new FixedClock(T0);
  const ids = new SequentialIds();
  if (withCard) await new CreateRateCardHandler(access, rateCards, ids, clock, events).handle({ actorId: OWNER, agencyId: AGENCY, ...scale() });
  events.published.length = 0;
  return {
    access, rateCards, quotes, idempotency, events, clock,
    issue: new IssueQuoteHandler(access, rateCards, quotes, idempotency, ids, clock, events),
    accept: new AcceptQuoteHandler(access, quotes, clock, events),
    get: new GetQuoteHandler(access, quotes, clock),
    list: new ListQuotesHandler(access, quotes, clock),
    preview: new PreviewQuoteHandler(access, rateCards),
  };
}

const order = (overrides: Partial<IssueQuoteCommand> = {}): IssueQuoteCommand => ({
  actorId: AGENT, agencyId: AGENCY, recipientName: 'Jean Kamga', recipientPhone: '+237 699 00 11 22', zoneId: AKWA,
  parcels: [parcel('0,8 kg'), parcel('3 kg')], manual: null, idempotencyKey: null, ...overrides,
});

test('an agent issues a quote: reference, total from the version in force, validity, QuoteIssued', async () => {
  const { issue, quotes, events } = await setup();
  const { replayed, quote } = await issue.handle(order());
  assert.equal(replayed, false);
  assert.deepEqual([quote.reference, quote.status, quote.total, quote.calculatedTotal, quote.rateCardVersion, quote.pricing, quote.manualPrice, quote.currency], ['DEV-2026-000001', 'issued', 2500, 2500, 1, 'priced', null, 'XAF']);
  assert.deepEqual([quote.recipient, quote.zone, quote.issuedBy, quote.issuedAt, quote.validUntil], [{ name: 'Jean Kamga', phone: '+237699001122' }, { id: AKWA, city: 'Douala', district: 'Akwa' }, AGENT, T0.toISOString(), new Date(T0.getTime() + 7 * DAY).toISOString()]);
  assert.equal(quotes.count(AGENCY), 1);
  assert.deepEqual(events.published, [{ type: 'QuoteIssued', agencyId: AGENCY, quoteId: quote.id, actorId: AGENT }]);
});

test('the owner and the administrator issue too: every active member does', async () => {
  const { issue } = await setup();
  for (const actorId of [OWNER, ADMIN, AGENT]) assert.equal((await issue.handle(order({ actorId }))).quote.status, 'issued', actorId);
});

test('the quote has the total of the simulation made with the same entries', async () => {
  const { issue, preview } = await setup();
  const simulated = await preview.handle({ agencyId: AGENCY, userId: AGENT, zoneId: AKWA, parcels: [parcel('0,8 kg'), parcel('3 kg')] });
  assert.equal((await issue.handle(order())).quote.total, simulated.total);
});

test('references count from 1 for each agency and each year, without a gap', async () => {
  const { issue, clock } = await setup();
  assert.deepEqual([(await issue.handle(order())).quote.reference, (await issue.handle(order())).quote.reference], ['DEV-2026-000001', 'DEV-2026-000002']);
  clock.advance(365 * DAY);
  assert.equal((await issue.handle(order())).quote.reference, 'DEV-2027-000001');
});

test('a negotiated price is retained with its reason, the calculation is kept', async () => {
  const { issue } = await setup();
  const { quote } = await issue.handle(order({ manual: { price: 2000, reason: 'client régulier' } }));
  assert.deepEqual([quote.total, quote.calculatedTotal, quote.manualPrice, quote.manualPriceReason], [2000, 2500, 2000, 'client régulier']);
});

test('a parcel out of the scale is quoted by hand; without a manual price it is invalid and nothing is written', async () => {
  const { issue, quotes, events } = await setup();
  const heavy = order({ parcels: [parcel('31 kg')] });
  await assert.rejects(issue.handle(heavy), kindOf('invalid', 'QUOTE_NOT_PRICEABLE'));
  await assert.rejects(issue.handle(order({ zoneId: DEIDO })), kindOf('invalid', 'QUOTE_NOT_PRICEABLE'));
  assert.equal(quotes.count(), 0);
  assert.deepEqual(events.published, []);
  const { quote } = await issue.handle({ ...heavy, manual: { price: 7000, reason: 'gros colis' } });
  assert.deepEqual([quote.total, quote.pricing, quote.calculatedTotal], [7000, 'out_of_scale', null]);
});

test('an agency without rate card can still quote by hand', async () => {
  const { issue } = await setup(false);
  await assert.rejects(issue.handle(order()), kindOf('invalid', 'QUOTE_NOT_PRICEABLE'));
  const { quote } = await issue.handle(order({ manual: { price: 1800, reason: 'zone proche' } }));
  assert.deepEqual([quote.rateCardVersion, quote.pricing, quote.total], [null, 'no_tariff', 1800]);
});

test('invalid entries are refused as invalid: recipient, parcels, manual price, reason', async () => {
  const { issue, quotes } = await setup();
  for (const bad of [
    order({ recipientName: 'J' }), order({ recipientPhone: '+33612345678' }), order({ parcels: [] }), order({ parcels: [parcel('lourd')] }),
    order({ manual: { price: 0, reason: 'client régulier' } }), order({ manual: { price: 2000, reason: 'ok' } }), order({ zoneId: 'akwa' }),
  ]) await assert.rejects(issue.handle(bad), kindOf('invalid'));
  assert.equal(quotes.count(), 0);
});

test('a retired zone and a suspended delivery refuse the quote; a zone of another agency or unknown is not found', async () => {
  const { issue, access, quotes } = await setup();
  await assert.rejects(issue.handle(order({ zoneId: RETIRED_ZONE })), kindOf('conflict', 'ZONE_RETIRED'));
  await assert.rejects(issue.handle(order({ zoneId: FOREIGN_ZONE })), kindOf('not_found'));
  await assert.rejects(issue.handle(order({ zoneId: uuid(999) })), kindOf('not_found'));
  access.deliveryActive = false;
  await assert.rejects(issue.handle(order()), kindOf('conflict', 'DELIVERY_NOT_ACTIVE'));
  assert.equal(quotes.count(), 0);
});

test('an outsider, a former member and the owner of another agency find nothing, and none of them takes the lock', async () => {
  const { issue, access, quotes, events } = await setup();
  const locksBefore = access.sharedLocks;
  for (const actorId of [OUTSIDER, FORMER, OTHER_OWNER]) await assert.rejects(issue.handle(order({ actorId })), kindOf('not_found'), actorId);
  await assert.rejects(issue.handle(order({ agencyId: uuid(999) })), kindOf('not_found'));
  assert.equal(access.sharedLocks, locksBefore);
  assert.equal(quotes.count(), 0);
  assert.deepEqual(events.published, []);
});

test('the role is decided again once the lock is held: a member removed while waiting is refused', async () => {
  const { issue, access, quotes } = await setup();
  access.onLock = () => access.setRole(AGENCY, AGENT, null);
  await assert.rejects(issue.handle(order()), kindOf('not_found'));
  assert.equal(quotes.count(), 0);
});

test('the same idempotency key with the same content returns the same quote and writes nothing more', async () => {
  const { issue, quotes, events } = await setup();
  const first = await issue.handle(order({ idempotencyKey: 'k-2026-11-10-01' }));
  const eventCount = events.published.length;
  const again = await issue.handle(order({ idempotencyKey: 'k-2026-11-10-01' }));
  assert.equal(again.replayed, true);
  assert.deepEqual(again.quote, first.quote);
  assert.deepEqual([quotes.count(), events.published.length], [1, eventCount]);
  assert.equal((await issue.handle(order())).quote.reference, 'DEV-2026-000002', 'and the number is not consumed by the replay');
});

test('the same key with another content is a conflict; the same key in another agency is another operation', async () => {
  const { issue, quotes } = await setup();
  await issue.handle(order({ idempotencyKey: 'k-2026-11-10-01' }));
  await assert.rejects(issue.handle(order({ idempotencyKey: 'k-2026-11-10-01', parcels: [parcel('1 kg')] })), kindOf('conflict', 'IDEMPOTENCY_KEY_REUSED'));
  await assert.rejects(issue.handle(order({ idempotencyKey: 'k-2026-11-10-01', recipientName: 'Autre Client' })), kindOf('conflict', 'IDEMPOTENCY_KEY_REUSED'));
  assert.equal(quotes.count(), 1);
});

test('the audit names the quote and the author, never the recipient, a phone number or an amount', async () => {
  const { issue, accept, events } = await setup();
  const { quote } = await issue.handle(order({ manual: { price: 2000, reason: 'client régulier' } }));
  await accept.handle({ actorId: ADMIN, agencyId: AGENCY, quoteId: quote.id });
  const audit = new InMemoryAuditLog();
  const subscriber = new PricingAuditSubscriber(audit);
  for (const event of events.published) await subscriber.handle(event);
  assert.deepEqual(audit.entries, [
    { userId: AGENT, action: 'pricing.quote_issued', agencyId: AGENCY, resourceId: quote.id },
    { userId: ADMIN, action: 'pricing.quote_accepted', agencyId: AGENCY, resourceId: quote.id },
  ]);
  const everything = JSON.stringify([audit.entries, events.published]);
  for (const secret of ['Jean', 'Kamga', '699', '2000', '2500', 'régulier', 'Akwa']) assert.ok(!everything.includes(secret), secret);
});

test('an agent accepts a quote on behalf of the client: accepted, dated, attributed, QuoteAccepted, nothing else', async () => {
  const { issue, accept, clock, events, quotes } = await setup();
  const { quote } = await issue.handle(order());
  events.published.length = 0;
  clock.advance(2 * DAY);
  const accepted = await accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: quote.id });
  assert.deepEqual([accepted.status, accepted.total, accepted.rateCardVersion, accepted.acceptedAt, accepted.acceptedBy], ['accepted', 2500, 1, clock.now().toISOString(), AGENT]);
  assert.deepEqual(events.types(), ['QuoteAccepted']);
  assert.deepEqual([quotes.locks, quotes.saves], [1, 1]);
});

test('a quote is accepted once: the second acceptance is a conflict that changes nothing', async () => {
  const { issue, accept, events, quotes, get } = await setup();
  const { quote } = await issue.handle(order());
  await accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: quote.id });
  const published = events.published.length;
  await assert.rejects(accept.handle({ actorId: ADMIN, agencyId: AGENCY, quoteId: quote.id }), kindOf('conflict', 'QUOTE_ALREADY_ACCEPTED'));
  assert.deepEqual([events.published.length, quotes.saves], [published, 1]);
  assert.equal((await get.handle({ agencyId: AGENCY, userId: ADMIN, quoteId: quote.id })).acceptedBy, AGENT);
});

test('a quote is accepted until its validity date included, not after', async () => {
  const { issue, accept, clock } = await setup();
  const first = (await issue.handle(order())).quote;
  const second = (await issue.handle(order())).quote;
  clock.advance(7 * DAY);
  assert.equal((await accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: first.id })).status, 'accepted');
  clock.advance(1);
  await assert.rejects(accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: second.id }), kindOf('conflict', 'QUOTE_EXPIRED'));
});

test('a quote is not accepted once its zone is retired or the delivery suspended, and stays issued', async () => {
  const { issue, accept, access, get } = await setup();
  const { quote } = await issue.handle(order());
  access.deliveryActive = false;
  await assert.rejects(accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: quote.id }), kindOf('conflict', 'DELIVERY_NOT_ACTIVE'));
  access.deliveryActive = true;
  access.setZones(AGENCY, DELIVERY_ZONES.map(zone => (zone.id === AKWA ? { ...zone, active: false } : zone)));
  await assert.rejects(accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: quote.id }), kindOf('conflict', 'ZONE_RETIRED'));
  assert.equal((await get.handle({ agencyId: AGENCY, userId: AGENT, quoteId: quote.id })).status, 'issued');
});

test('accepting asks nothing of another module and creates no order: only the quotes, the agency access and the events are touched', async () => {
  const { issue, accept, events } = await setup();
  const { quote } = await issue.handle(order());
  events.published.length = 0;
  await accept.handle({ actorId: OWNER, agencyId: AGENCY, quoteId: quote.id });
  assert.deepEqual(events.published.map(event => event.type), ['QuoteAccepted']);
});

test('acceptance and reading are hidden from the outsider, the former member, the owner of another agency, and for a quote of another agency or unknown', async () => {
  const { issue, accept, get, access, quotes } = await setup();
  const { quote } = await issue.handle(order());
  const locksBefore = access.sharedLocks;
  for (const actorId of [OUTSIDER, FORMER, OTHER_OWNER]) {
    await assert.rejects(accept.handle({ actorId, agencyId: AGENCY, quoteId: quote.id }), kindOf('not_found'), actorId);
    await assert.rejects(get.handle({ agencyId: AGENCY, userId: actorId, quoteId: quote.id }), kindOf('not_found'), actorId);
  }
  assert.equal(access.sharedLocks, locksBefore, 'nobody refused took the lock');
  await assert.rejects(accept.handle({ actorId: OTHER_OWNER, agencyId: OTHER_AGENCY, quoteId: quote.id }), kindOf('not_found'), 'the quote of another agency is not found through the agency of the caller');
  await assert.rejects(get.handle({ agencyId: OTHER_AGENCY, userId: OTHER_OWNER, quoteId: quote.id }), kindOf('not_found'));
  await assert.rejects(accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: uuid(999) }), kindOf('not_found'));
  assert.equal(quotes.saves, 0);
});

test('reading a quote gives the whole of it with its derived state: issued, then expired, then accepted', async () => {
  const { issue, get, accept, clock } = await setup();
  const { quote } = await issue.handle(order());
  const read = (userId = AGENT) => get.handle({ agencyId: AGENCY, userId, quoteId: quote.id });
  assert.deepEqual(await read(), quote);
  clock.advance(7 * DAY);
  assert.equal((await read()).status, 'issued');
  clock.advance(1);
  assert.equal((await read()).status, 'expired');
  const other = (await issue.handle(order())).quote;
  await accept.handle({ actorId: AGENT, agencyId: AGENCY, quoteId: other.id });
  clock.advance(30 * DAY);
  assert.equal((await get.handle({ agencyId: AGENCY, userId: AGENT, quoteId: other.id })).status, 'accepted');
});

test('the list is paginated by cursor, the most recent first, and holds only the quotes of the agency', async () => {
  const { issue, list, clock, access } = await setup();
  access.setZones(OTHER_AGENCY, DELIVERY_ZONES);
  const issued: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    clock.advance(1000);
    issued.push((await issue.handle(order({ zoneId: index === 1 ? BONABERI : AKWA, parcels: [parcel('1 kg')] }))).quote.id);
  }
  const first = await list.handle({ agencyId: AGENCY, userId: AGENT, cursor: null, limit: 2 });
  assert.deepEqual(first.items.map(item => item.id), [issued[2], issued[1]]);
  assert.deepEqual([first.hasMore, typeof first.nextCursor], [true, 'string']);
  assert.deepEqual(Object.keys(first.items[0] ?? {}).sort(), ['acceptedAt', 'currency', 'id', 'issuedAt', 'recipientName', 'reference', 'status', 'total', 'validUntil', 'zone']);
  const cursor = first.nextCursor === null ? null : decodeQuoteCursor(first.nextCursor);
  const second = await list.handle({ agencyId: AGENCY, userId: AGENT, cursor, limit: 2 });
  assert.deepEqual([second.items.map(item => item.id), second.hasMore, second.nextCursor], [[issued[0]], false, null]);
  assert.deepEqual((await list.handle({ agencyId: OTHER_AGENCY, userId: OTHER_OWNER, cursor: null, limit: 20 })).items, []);
  await assert.rejects(list.handle({ agencyId: AGENCY, userId: OUTSIDER, cursor: null, limit: 20 }), kindOf('not_found'));
  await assert.rejects(list.handle({ agencyId: AGENCY, userId: FORMER, cursor: null, limit: 20 }), kindOf('not_found'));
});

test('the cursor of a page is read back, and anything the system did not write is refused', () => {
  const valid = Buffer.from(`2026-01-01T00:00:01.000Z|${uuid(5)}`).toString('base64url');
  assert.deepEqual(decodeQuoteCursor(valid), { issuedAt: '2026-01-01T00:00:01.000Z', id: uuid(5) });
  for (const bad of ['', 'x', '!!!', Buffer.from('nope').toString('base64url'), Buffer.from(`2026-01-01|${uuid(5)}`).toString('base64url'), Buffer.from(`2026-01-01T00:00:01.000Z|not-a-uuid`).toString('base64url'), 'a'.repeat(500)]) assert.equal(decodeQuoteCursor(bad), null, bad);
});
