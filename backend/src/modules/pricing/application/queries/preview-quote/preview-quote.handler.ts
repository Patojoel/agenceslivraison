import { Inject, Injectable } from '@nestjs/common';
import { PricingZoneNotFound, PricingZoneRetired } from '../../../domain/exceptions/pricing.exceptions';
import { RATE_CARD_REPOSITORY, RateCardRepository } from '../../../domain/ports/rate-card.repository';
import { measureParcels } from '../../../domain/rate-card-version';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { ZoneId } from '../../../domain/value-objects/zone-id';
import { mayReadPricing } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { requireRole } from '../../require-role';
import { PreviewQuoteQuery } from './preview-quote.query';
import { PreviewQuoteResponse } from './preview-quote.response';

const NOTICE = 'prix indicatif, non garanti sans devis';

/** Reads only: nothing is written, no quote exists afterwards, no lock is taken. */
@Injectable()
export class PreviewQuoteHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(RATE_CARD_REPOSITORY) private readonly rateCards: RateCardRepository,
  ) {}

  async handle(query: PreviewQuoteQuery): Promise<PreviewQuoteResponse> {
    const agencyId = AgencyId.of(query.agencyId);
    await requireRole(this.access, agencyId.value, query.userId, mayReadPricing);
    const zoneId = ZoneId.of(query.zoneId).value;
    measureParcels(query.parcels);
    const zone = (await this.access.deliveryState(agencyId.value)).zones.find(candidate => candidate.id === zoneId);
    if (!zone) throw new PricingZoneNotFound();
    if (!zone.active) throw new PricingZoneRetired();
    const card = await this.rateCards.findByAgency(agencyId);
    const base = { currency: 'XAF', indicative: true, notice: NOTICE, version: card?.snapshot().current.number ?? null, zoneId } as const;
    if (!card) return { ...base, status: 'no_tariff', parcels: [], total: null };
    const result = card.quote(zoneId, query.parcels);
    switch (result.status) {
      case 'no_tariff': return { ...base, status: 'no_tariff', parcels: [], total: null };
      case 'out_of_scale': return { ...base, status: 'out_of_scale', parcels: result.parcels, total: null };
      case 'priced': return { ...base, status: 'priced', parcels: result.parcels, total: result.total };
    }
  }
}
