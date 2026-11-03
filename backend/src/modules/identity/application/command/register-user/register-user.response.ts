import { AccountType } from '../../../domain/account-type';

export interface RegisterUserResponse {
  readonly id: string;
  readonly accountType: AccountType;
}
