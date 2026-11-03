import { SqlReader } from '../../../../../shared/application/ports/sql-reader';
import { ListMyAgenciesQuery } from './list-my-agencies.query';
import { ListMyAgenciesResponse } from './list-my-agencies.response';

const SQL = `
  SELECT agency_id, role
  FROM agency_memberships
  WHERE user_id = $1 AND active = true AND ($2::uuid IS NULL OR agency_id > $2::uuid)
  ORDER BY agency_id
  LIMIT $3`;

export class ListMyAgenciesQueryHandler {
  constructor(private readonly reader: SqlReader) {}

  async handle(query: ListMyAgenciesQuery): Promise<ListMyAgenciesResponse> {
    const rows = await this.reader.query<{ agency_id: string; role: string }>(SQL, [query.userId, query.cursor, query.limit + 1]);
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map(row => ({ agencyId: row.agency_id, role: row.role }));
    return { items, hasMore, nextCursor: hasMore ? items[items.length - 1].agencyId : null };
  }
}
