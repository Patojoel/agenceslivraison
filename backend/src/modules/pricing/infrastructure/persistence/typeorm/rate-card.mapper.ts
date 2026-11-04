import { UserId } from '@shared/domain/value-objects/user-id';
import { RateCard } from '../../../domain/rate-card';
import { RateCardContent, RateCardLine } from '../../../domain/rate-card-content';
import { RateCardVersion } from '../../../domain/rate-card-version';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { Price } from '../../../domain/value-objects/price';
import { RateCardId } from '../../../domain/value-objects/rate-card-id';
import { VolumetricDivisor } from '../../../domain/value-objects/volumetric-divisor';
import { Weight } from '../../../domain/value-objects/weight';
import { ZoneId } from '../../../domain/value-objects/zone-id';
import { RateCardLineOrmEntity } from './rate-card-line.orm-entity';
import { RateCardVersionOrmEntity } from './rate-card-version.orm-entity';
import { RateCardOrmEntity } from './rate-card.orm-entity';

export class RateCardMapper {
  static cardToOrm(card: RateCard): RateCardOrmEntity {
    const { id, agencyId, current } = card.snapshot();
    const entity = new RateCardOrmEntity();
    entity.id = id.value;
    entity.agencyId = agencyId.value;
    entity.currentVersion = current.number;
    entity.createdAt = current.createdAt;
    return entity;
  }

  static versionToOrm(card: RateCard): RateCardVersionOrmEntity {
    const { id, agencyId, current } = card.snapshot();
    const entity = new RateCardVersionOrmEntity();
    entity.rateCardId = id.value;
    entity.number = current.number;
    entity.agencyId = agencyId.value;
    entity.volumetricDivisor = current.content.divisor?.value ?? null;
    entity.createdBy = current.createdBy.value;
    entity.createdAt = current.createdAt;
    return entity;
  }

  /** One row per tier, numbered from 1 in the order of the bounds. */
  static linesToOrm(card: RateCard): RateCardLineOrmEntity[] {
    const { id, agencyId, current } = card.snapshot();
    return current.content.lines.flatMap(line => line.tiers.map((tier, index) => {
      const entity = new RateCardLineOrmEntity();
      entity.rateCardId = id.value;
      entity.versionNumber = current.number;
      entity.zoneId = line.zoneId.value;
      entity.position = index + 1;
      entity.agencyId = agencyId.value;
      entity.maxWeightGrams = tier.upTo.grams;
      entity.priceXaf = tier.price.value;
      return entity;
    }));
  }

  /** `rows` ordered by zone then position. */
  static toDomain(card: RateCardOrmEntity, version: RateCardVersionOrmEntity, rows: readonly RateCardLineOrmEntity[]): RateCard {
    const lines: RateCardLine[] = [];
    for (const row of rows) {
      const tier = { upTo: Weight.ofGrams(row.maxWeightGrams), price: Price.of(row.priceXaf) };
      const last = lines[lines.length - 1];
      if (last && last.zoneId.value === row.zoneId) lines[lines.length - 1] = { zoneId: last.zoneId, tiers: [...last.tiers, tier] };
      else lines.push({ zoneId: ZoneId.of(row.zoneId), tiers: [tier] });
    }
    const divisor = version.volumetricDivisor === null ? null : VolumetricDivisor.of(version.volumetricDivisor);
    return RateCard.reconstitute({
      id: RateCardId.of(card.id),
      agencyId: AgencyId.of(card.agencyId),
      current: new RateCardVersion(version.number, RateCardContent.reconstitute(divisor, lines), UserId.of(version.createdBy), version.createdAt),
    });
  }
}
