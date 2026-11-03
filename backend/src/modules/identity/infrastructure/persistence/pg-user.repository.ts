import { Database } from '../../../../shared/infrastructure/db/database';
import { Email } from '../../../../shared/domain/vo/email';
import { UserId } from '../../../../shared/domain/vo/user-id';
import { AccountType } from '../../domain/account-type';
import { EmailAlreadyRegistered } from '../../domain/exceptions/identity.exceptions';
import { User } from '../../domain/model/user';
import { UserRepository } from '../../domain/repositories/user.repository';

const UNIQUE_VIOLATION = '23505';

export class PgUserRepository implements UserRepository {
  constructor(private readonly database: Database) {}

  async add(user: User): Promise<void> {
    try {
      await this.database.execute(
        'INSERT INTO users (id, email, password_hash, account_type) VALUES ($1, $2, $3, $4)',
        [user.id.value, user.email.value, user.passwordHash, user.accountType],
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === UNIQUE_VIOLATION) throw new EmailAlreadyRegistered();
      throw error;
    }
  }

  async findByEmail(email: Email): Promise<User | null> {
    const [row] = await this.database.query<{ id: string; email: string; password_hash: string; account_type: AccountType }>(
      'SELECT id, email, password_hash, account_type FROM users WHERE email = $1', [email.value],
    );
    if (!row) return null;
    return User.reconstitute({ id: UserId.of(row.id), email: Email.of(row.email), passwordHash: row.password_hash, accountType: row.account_type });
  }
}
