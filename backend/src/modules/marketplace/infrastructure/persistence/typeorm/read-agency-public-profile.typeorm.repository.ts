import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { PublicProfileRecord, ReadAgencyPublicProfileRepository } from '../../../application/ports/read-agency-public-profile.repository';

const PROFILE = `
  SELECT slug, published, published_at, unpublished_at
  FROM agency_public_profiles
  WHERE agency_id = $1::uuid`;

@Injectable()
export class ReadAgencyPublicProfileTypeOrmRepository implements ReadAgencyPublicProfileRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async findRecord(agencyId: string): Promise<PublicProfileRecord | null> {
    const manager = await this.connection.manager();
    const rows: { slug: string; published: boolean; published_at: Date; unpublished_at: Date | null }[] = await manager.query(PROFILE, [agencyId]);
    const row = rows[0];
    return row ? { slug: row.slug, published: row.published, publishedAt: row.published_at, unpublishedAt: row.unpublished_at } : null;
  }
}
