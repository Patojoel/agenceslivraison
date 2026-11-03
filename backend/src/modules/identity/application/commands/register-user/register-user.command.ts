import { AccountType } from '../../../domain/account-type';

export interface RegisterUserCommand {
  readonly email: string;
  readonly password: string;
  readonly accountType: AccountType;
}
