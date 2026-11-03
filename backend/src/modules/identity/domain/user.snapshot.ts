import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AccountType } from './account-type';

export interface UserSnapshot {
  readonly id: UserId;
  readonly email: Email;
  readonly passwordHash: string;
  readonly accountType: AccountType;
}
