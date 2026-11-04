import { CursorPage } from '@shared/application/pagination/cursor-page';
import { AgencyMemberReadModel } from '../../read-models/agency-member.read-model';

export type ListAgencyMembersResponse = CursorPage<AgencyMemberReadModel>;
