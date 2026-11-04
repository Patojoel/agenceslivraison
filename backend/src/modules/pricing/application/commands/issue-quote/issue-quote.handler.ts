import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { IDEMPOTENCY_KEYS, IdempotencyKeys } from '@shared/application/ports/idempotency-keys.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { QuoteIdempotencyKeyReused } from '../../../domain/exceptions/pricing.exceptions';
import { QUOTE_REPOSITORY, QuoteRepository } from '../../../domain/ports/quote.repository';
import { RATE_CARD_REPOSITORY, RateCardRepository } from '../../../domain/ports/rate-card.repository';
import { Quote } from '../../../domain/quote';
import { measureParcels } from '../../../domain/rate-card-version';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { ManualPrice } from '../../../domain/value-objects/manual-price';
import { QuoteId } from '../../../domain/value-objects/quote-id';
import { QuoteReference } from '../../../domain/value-objects/quote-reference';
import { Recipient } from '../../../domain/value-objects/recipient';
import { ZoneId } from '../../../domain/value-objects/zone-id';
import { mayIssueQuotes } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { recordOfQuote, toQuoteReadModel } from '../../read-models/quote.read-model';
import { lockAgencyForWrite } from '../../require-role';
import { IssueQuoteCommand } from './issue-quote.command';
import { IssueQuoteResponse } from './issue-quote.response';

/** A key protects one agency: the same key used in two agencies is two operations. */
const scopeOf = (agencyId: AgencyId): string => `pricing.quote.issue:${agencyId.value}`;

@Injectable()
export class IssueQuoteHandler implements CommandHandler<IssueQuoteCommand, IssueQuoteResponse> {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(RATE_CARD_REPOSITORY) private readonly rateCards: RateCardRepository,
    @Inject(QUOTE_REPOSITORY) private readonly quotes: QuoteRepository,
    @Inject(IDEMPOTENCY_KEYS) private readonly idempotency: IdempotencyKeys,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: IssueQuoteCommand): Promise<IssueQuoteResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const state = await lockAgencyForWrite(this.access, agencyId.value, actorId.value, mayIssueQuotes);
    const zoneId = ZoneId.of(command.zoneId);
    const recipient = Recipient.of(command.recipientName, command.recipientPhone);
    const measured = measureParcels(command.parcels);
    const manual = command.manual === null ? null : ManualPrice.of(command.manual.price, command.manual.reason);
    const quoteId = QuoteId.of(this.uuid.generate());
    const now = this.clock.now();
    if (command.idempotencyKey !== null) {
      const fingerprint = JSON.stringify([
        recipient.name, recipient.phone, zoneId.value,
        measured.map(parcel => [parcel.weight.grams, parcel.dimensions && [parcel.dimensions.length, parcel.dimensions.width, parcel.dimensions.height]]),
        manual?.price ?? null, manual?.reason ?? null,
      ]);
      const claim = await this.idempotency.claim({ actorId: actorId.value, scope: scopeOf(agencyId), key: command.idempotencyKey, fingerprint, resourceId: quoteId.value });
      if (claim.kind === 'mismatch') throw new QuoteIdempotencyKeyReused();
      if (claim.kind === 'replayed') {
        const original = await this.quotes.findById(agencyId, QuoteId.of(claim.resourceId));
        if (!original) throw new Error('Idempotency record points to a quote that does not exist');
        return { replayed: true, quote: toQuoteReadModel(recordOfQuote(original.snapshot()), now) };
      }
    }
    const zone = state.zones.find(candidate => candidate.id === zoneId.value) ?? null;
    const rateCard = await this.rateCards.findByAgency(agencyId);
    const number = await this.quotes.nextNumber(agencyId, now.getUTCFullYear());
    const quote = Quote.issue({
      id: quoteId, agencyId, reference: QuoteReference.of(now.getUTCFullYear(), number), recipient, zone,
      deliveryActive: state.deliveryActive, rateCard, parcels: command.parcels, manual, issuedBy: actorId, now,
    });
    await this.quotes.add(quote);
    await this.events.publish(quote.pullEvents());
    return { replayed: false, quote: toQuoteReadModel(recordOfQuote(quote.snapshot()), now) };
  }
}
