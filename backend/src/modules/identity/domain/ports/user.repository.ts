import { Email } from '@shared/domain/value-objects/email';
import { User } from '../user';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository {
  /** @throws EmailAlreadyRegistered */
  add(user: User): Promise<void>;
  findByEmail(email: Email): Promise<User | null>;
}
