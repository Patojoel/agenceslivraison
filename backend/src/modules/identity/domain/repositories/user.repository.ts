import { Email } from '../../../../shared/domain/vo/email';
import { User } from '../model/user';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  /** @throws EmailAlreadyRegistered */
  add(user: User): Promise<void>;
  findByEmail(email: Email): Promise<User | null>;
}
