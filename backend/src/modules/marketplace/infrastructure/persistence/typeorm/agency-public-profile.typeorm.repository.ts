import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { AgencyPublicProfile } from '../../../domain/agency-public-profile';
import { AddProfileOutcome, AgencyPublicProfileRepository } from '../../../domain/ports/agency-public-profile.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { AgencyPublicProfileMapper } from './agency-public-profile.mapper';
import { AgencyPublicProfileOrmEntity } from './agency-public-profile.orm-entity';

/**
 * Plain SQL on purpose: a conflict on the agency (two first publications at once) or on the slug (two homonymous
 * agencies at once) must be an answer, not an error: a failed statement aborts the transaction of the command. Without a
 * conflict target, `DO NOTHING` covers both unique indexes; a request that meets an uncommitted row waits for it.
 */
const INSERT_PROFILE = `
  INSERT INTO agency_public_profiles (agency_id, slug, published, published_at, published_by, unpublished_at)
  VALUES ($1::uuid, $2, $3::boolean, $4::timestamptz, $5::uuid, $6::timestamptz)
  ON CONFLICT DO NOTHING
  RETURNING agency_id`;
const HAS_PROFILE = 'SELECT agency_id FROM agency_public_profiles WHERE agency_id = $1::uuid';

@Injectable()
export class AgencyPublicProfileTypeOrmRepository implements AgencyPublicProfileRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async lockByAgency(agencyId: AgencyId): Promise<AgencyPublicProfile | null> {
    const manager = await this.connection.manager();
    const row = await manager.findOne(AgencyPublicProfileOrmEntity, { where: { agencyId: agencyId.value }, lock: { mode: 'pessimistic_write' } });
    return row ? AgencyPublicProfileMapper.toDomain(row) : null;
  }

  async add(profile: AgencyPublicProfile): Promise<AddProfileOutcome> {
    const manager = await this.connection.manager();
    const row = AgencyPublicProfileMapper.toOrm(profile);
    const inserted: { agency_id: string }[] = await manager.query(INSERT_PROFILE, [row.agencyId, row.slug, row.published, row.publishedAt, row.publishedBy, row.unpublishedAt]);
    if (inserted.length > 0) return 'added';
    const existing: { agency_id: string }[] = await manager.query(HAS_PROFILE, [row.agencyId]);
    return existing.length > 0 ? 'already_has_profile' : 'slug_taken';
  }

  /** The address is never rewritten: it is not among the columns this statement can set. */
  async save(profile: AgencyPublicProfile): Promise<void> {
    const manager = await this.connection.manager();
    const row = AgencyPublicProfileMapper.toOrm(profile);
    await manager.update(AgencyPublicProfileOrmEntity, { agencyId: row.agencyId }, { published: row.published, publishedAt: row.publishedAt, publishedBy: row.publishedBy, unpublishedAt: row.unpublishedAt });
  }
}
