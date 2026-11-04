import { Inject, Injectable } from '@nestjs/common';
import { RateCardVersionNotFound } from '../../../domain/exceptions/pricing.exceptions';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayReadPricing } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { READ_RATE_CARD_REPOSITORY, ReadRateCardRepository } from '../../ports/read-rate-card.repository';
import { toRateCardReadModel } from '../../read-models/rate-card.read-model';
import { requireRole } from '../../require-role';
import { GetRateCardVersionQuery } from './get-rate-card-version.query';
import { GetRateCardVersionResponse } from './get-rate-card-version.response';

@Injectable()
export class GetRateCardVersionHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(READ_RATE_CARD_REPOSITORY) private readonly rateCards: ReadRateCardRepository,
  ) {}

  /** Any version, as it was written: the zone labels and statuses are those of the agency now. */
  async handle(query: GetRateCardVersionQuery): Promise<GetRateCardVersionResponse> {
    const agencyId = AgencyId.of(query.agencyId).value;
    await requireRole(this.access, agencyId, query.userId, mayReadPricing);
    const record = await this.rateCards.findVersion(agencyId, query.number);
    if (!record) throw new RateCardVersionNotFound();
    return toRateCardReadModel(record, (await this.access.deliveryState(agencyId)).zones);
  }
}
