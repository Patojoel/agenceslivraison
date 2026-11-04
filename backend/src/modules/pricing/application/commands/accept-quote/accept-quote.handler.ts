import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { QuoteNotFound } from '../../../domain/exceptions/pricing.exceptions';
import { QUOTE_REPOSITORY, QuoteRepository } from '../../../domain/ports/quote.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { QuoteId } from '../../../domain/value-objects/quote-id';
import { mayIssueQuotes } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { recordOfQuote, toQuoteReadModel } from '../../read-models/quote.read-model';
import { lockAgencyForWrite } from '../../require-role';
import { AcceptQuoteCommand } from './accept-quote.command';
import { AcceptQuoteResponse } from './accept-quote.response';

/**
 * Locks in a fixed order, the same as every write of this module: the agency (shared, so a zone cannot be retired
 * meanwhile), then the quote. A quote of another agency is not found, as an unknown one is.
 */
@Injectable()
export class AcceptQuoteHandler implements CommandHandler<AcceptQuoteCommand, AcceptQuoteResponse> {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(QUOTE_REPOSITORY) private readonly quotes: QuoteRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: AcceptQuoteCommand): Promise<AcceptQuoteResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const quoteId = QuoteId.of(command.quoteId);
    const state = await lockAgencyForWrite(this.access, agencyId.value, actorId.value, mayIssueQuotes);
    const quote = await this.quotes.lockById(agencyId, quoteId);
    if (!quote) throw new QuoteNotFound();
    const now = this.clock.now();
    quote.accept({
      actorId, now, deliveryActive: state.deliveryActive,
      zone: state.zones.find(candidate => candidate.id === quote.snapshot().zone.id.value) ?? null,
    });
    await this.quotes.save(quote);
    await this.events.publish(quote.pullEvents());
    return toQuoteReadModel(recordOfQuote(quote.snapshot()), now);
  }
}
