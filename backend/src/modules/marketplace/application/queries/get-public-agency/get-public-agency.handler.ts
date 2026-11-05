import { Inject, Injectable } from '@nestjs/common';
import { InvalidPublicSlug, PublicAgencyNotFound } from '../../../domain/exceptions/marketplace.exceptions';
import { PublicSlug } from '../../../domain/value-objects/public-slug';
import { READ_PUBLIC_DIRECTORY_REPOSITORY, ReadPublicDirectoryRepository } from '../../ports/read-public-directory.repository';
import { toDetail } from '../../read-models/public-agency.read-model';
import { GetPublicAgencyQuery } from './get-public-agency.query';
import { GetPublicAgencyResponse } from './get-public-agency.response';

/**
 * The fiche of one agency by its address (UC-03-04). An address that is unknown, malformed, withdrawn, hidden or not yet
 * published gets the same "not found": nothing tells a visitor that an agency exists behind it.
 */
@Injectable()
export class GetPublicAgencyHandler {
  constructor(@Inject(READ_PUBLIC_DIRECTORY_REPOSITORY) private readonly directory: ReadPublicDirectoryRepository) {}

  async handle(query: GetPublicAgencyQuery): Promise<GetPublicAgencyResponse> {
    const record = await this.directory.findVisibleBySlug(this.addressOf(query.slug));
    if (record === null) throw new PublicAgencyNotFound();
    return toDetail(record);
  }

  private addressOf(raw: string): string {
    try {
      return PublicSlug.reconstitute(raw).value;
    } catch (error) {
      if (error instanceof InvalidPublicSlug) throw new PublicAgencyNotFound();
      throw error;
    }
  }
}
