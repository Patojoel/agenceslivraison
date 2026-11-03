import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { ACCOUNT_TYPES, AccountType } from '../../../domain/account-type';
import { User } from '../../../domain/user';
import { UserOrmEntity } from './user.orm-entity';

const isAccountType = (value: string | null): value is AccountType => ACCOUNT_TYPES.some(type => type === value);

export class UserMapper {
  /** Only accounts with credentials become a `User`: the CHECK constraint guarantees they are complete. */
  static toDomain(entity: UserOrmEntity): User {
    if (entity.email === null || entity.passwordHash === null || !isAccountType(entity.accountType)) {
      throw new Error('User row without complete credentials');
    }
    return User.reconstitute({
      id: UserId.of(entity.id),
      email: Email.of(entity.email),
      passwordHash: entity.passwordHash,
      accountType: entity.accountType,
    });
  }

  static toOrm(user: User): UserOrmEntity {
    const entity = new UserOrmEntity();
    entity.id = user.id.value;
    entity.email = user.email.value;
    entity.passwordHash = user.passwordHash;
    entity.accountType = user.accountType;
    return entity;
  }
}
