import { Inject, Injectable } from '@nestjs/common';
import { PublicCursor } from '../../../domain/value-objects/public-cursor';
import { PublicSearchCriteria } from '../../../domain/value-objects/public-search-criteria';
import { READ_PUBLIC_DIRECTORY_REPOSITORY, ReadPublicDirectoryRepository } from '../../ports/read-public-directory.repository';
import { toSummary } from '../../read-models/public-agency.read-model';
import { SearchPublicAgenciesQuery } from './search-public-agencies.query';
import { SearchPublicAgenciesResponse } from './search-public-agencies.response';

/** The public directory (UC-03-02, UC-03-03): visible fiches only, alphabetical, one page after the cursor. No identity, no right to check. */
@Injectable()
export class SearchPublicAgenciesHandler {
  constructor(@Inject(READ_PUBLIC_DIRECTORY_REPOSITORY) private readonly directory: ReadPublicDirectoryRepository) {}

  async handle(query: SearchPublicAgenciesQuery): Promise<SearchPublicAgenciesResponse> {
    const criteria = PublicSearchCriteria.of(query);
    const after = query.cursor === undefined ? null : PublicCursor.decode(query.cursor, criteria.canonical);
    const rows = await this.directory.search(criteria, after, criteria.limit + 1);
    const page = rows.slice(0, criteria.limit);
    const last = page[page.length - 1];
    const hasMore = rows.length > criteria.limit && last !== undefined;
    return {
      items: page.map(toSummary),
      nextCursor: hasMore ? PublicCursor.encode(criteria.canonical, { nameKey: last.nameKey, slug: last.slug }) : null,
      hasMore,
    };
  }
}
