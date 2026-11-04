import { Inject, Injectable } from '@nestjs/common';
import { RateCardNotFound } from '../../../domain/exceptions/pricing.exceptions';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayReadPricing } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { READ_RATE_CARD_REPOSITORY, ReadRateCardRepository } from '../../ports/read-rate-card.repository';
import { toRateCardReadModel } from '../../read-models/rate-card.read-model';
import { requireRole } from '../../require-role';
import { GetRateCardQuery } from './get-rate-card.query';
import { GetRateCardResponse } from './get-rate-card.response';

@Injectable()
export class GetRateCardHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(READ_RATE_CARD_REPOSITORY) private readonly rateCards: ReadRateCardRepository,
  ) {}

  /** The version in force. */
  async handle(query: GetRateCardQuery): Promise<GetRateCardResponse> {
    const agencyId = AgencyId.of(query.agencyId).value;
    await requireRole(this.access, agencyId, query.userId, mayReadPricing);
    const record = await this.rateCards.findVersion(agencyId, null);
    if (!record) throw new RateCardNotFound();
    return toRateCardReadModel(record, (await this.access.deliveryState(agencyId)).zones);
  }
}
