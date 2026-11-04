import { UserId } from '@shared/domain/value-objects/user-id';
import { Quote, QuoteParcel } from '../../../domain/quote';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { ManualPrice } from '../../../domain/value-objects/manual-price';
import { QuoteId } from '../../../domain/value-objects/quote-id';
import { QuoteReference } from '../../../domain/value-objects/quote-reference';
import { Recipient } from '../../../domain/value-objects/recipient';
import { ZoneId } from '../../../domain/value-objects/zone-id';
import { QuoteOrmEntity } from './quote.orm-entity';

/** The parcels are stored as written by `toOrm`: only the known fields are read back. */
function parcelOf(stored: QuoteParcel): QuoteParcel {
  const { dimensions } = stored;
  return {
    weightGrams: stored.weightGrams,
    dimensions: dimensions === null ? null : { length: dimensions.length, width: dimensions.width, height: dimensions.height },
    taxableGrams: stored.taxableGrams,
    price: stored.price,
  };
}

export class QuoteMapper {
  static toOrm(quote: Quote): QuoteOrmEntity {
    const snapshot = quote.snapshot();
    const entity = new QuoteOrmEntity();
    entity.id = snapshot.id.value;
    entity.agencyId = snapshot.agencyId.value;
    entity.reference = snapshot.reference.value;
    entity.recipientName = snapshot.recipient.name;
    entity.recipientPhone = snapshot.recipient.phone;
    entity.zoneId = snapshot.zone.id.value;
    entity.zoneCity = snapshot.zone.city;
    entity.zoneDistrict = snapshot.zone.district;
    entity.parcels = snapshot.parcels.map(parcelOf);
    entity.rateCardVersion = snapshot.rateCardVersion;
    entity.pricingStatus = snapshot.pricing;
    entity.calculatedTotalXaf = snapshot.calculatedTotal;
    entity.manualPriceXaf = snapshot.manual?.price ?? null;
    entity.manualPriceReason = snapshot.manual?.reason ?? null;
    entity.totalXaf = snapshot.total;
    entity.issuedAt = snapshot.issuedAt;
    entity.issuedBy = snapshot.issuedBy.value;
    entity.validUntil = snapshot.validUntil;
    entity.status = snapshot.status;
    entity.acceptedAt = snapshot.acceptedAt;
    entity.acceptedBy = snapshot.acceptedBy?.value ?? null;
    return entity;
  }

  static toDomain(row: QuoteOrmEntity): Quote {
    return Quote.reconstitute({
      id: QuoteId.of(row.id),
      agencyId: AgencyId.of(row.agencyId),
      reference: QuoteReference.parse(row.reference),
      recipient: Recipient.reconstitute(row.recipientName, row.recipientPhone),
      zone: { id: ZoneId.of(row.zoneId), city: row.zoneCity, district: row.zoneDistrict },
      parcels: row.parcels.map(parcelOf),
      rateCardVersion: row.rateCardVersion,
      pricing: row.pricingStatus,
      calculatedTotal: row.calculatedTotalXaf,
      manual: row.manualPriceXaf === null || row.manualPriceReason === null ? null : ManualPrice.of(row.manualPriceXaf, row.manualPriceReason),
      total: row.totalXaf,
      issuedAt: row.issuedAt,
      issuedBy: UserId.of(row.issuedBy),
      validUntil: row.validUntil,
      status: row.status,
      acceptedAt: row.acceptedAt,
      acceptedBy: row.acceptedBy === null ? null : UserId.of(row.acceptedBy),
    });
  }
}
