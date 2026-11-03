import { Email } from '@shared/domain/value-objects/email';
import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { InvitationRole } from './agency-role';
import { AgencyId } from './value-objects/agency-id';
import { InvitationId } from './value-objects/invitation-id';

export interface InvitationSnapshot {
  readonly id: InvitationId;
  readonly agencyId: AgencyId;
  readonly email: Email;
  readonly role: InvitationRole;
  readonly tokenDigest: TokenDigest;
  readonly createdBy: UserId;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
}
