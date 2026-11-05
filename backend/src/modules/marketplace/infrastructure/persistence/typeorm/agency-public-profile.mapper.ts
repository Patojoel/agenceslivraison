import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyPublicProfile } from '../../../domain/agency-public-profile';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { PublicSlug } from '../../../domain/value-objects/public-slug';
import { AgencyPublicProfileOrmEntity } from './agency-public-profile.orm-entity';

export class AgencyPublicProfileMapper {
  static toOrm(profile: AgencyPublicProfile): AgencyPublicProfileOrmEntity {
    const snapshot = profile.snapshot();
    const entity = new AgencyPublicProfileOrmEntity();
    entity.agencyId = snapshot.agencyId.value;
    entity.slug = snapshot.slug.value;
    entity.published = snapshot.published;
    entity.publishedAt = snapshot.publishedAt;
    entity.publishedBy = snapshot.publishedBy.value;
    entity.unpublishedAt = snapshot.unpublishedAt;
    return entity;
  }

  static toDomain(row: AgencyPublicProfileOrmEntity): AgencyPublicProfile {
    return AgencyPublicProfile.reconstitute({
      agencyId: AgencyId.of(row.agencyId),
      slug: PublicSlug.reconstitute(row.slug),
      published: row.published,
      publishedAt: row.publishedAt,
      publishedBy: UserId.of(row.publishedBy),
      unpublishedAt: row.unpublishedAt,
    });
  }
}
