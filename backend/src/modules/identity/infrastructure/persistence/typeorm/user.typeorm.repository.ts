import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Email } from '@shared/domain/value-objects/email';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { EmailAlreadyRegistered } from '../../../domain/exceptions/identity.exceptions';
import { UserRepository } from '../../../domain/ports/user.repository';
import { User } from '../../../domain/user';
import { UserMapper } from './user.mapper';
import { UserOrmEntity } from './user.orm-entity';

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION;

@Injectable()
export class UserTypeOrmRepository implements UserRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async add(user: User): Promise<void> {
    const manager = await this.connection.manager();
    try {
      await manager.insert(UserOrmEntity, UserMapper.toOrm(user));
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyRegistered();
      throw error;
    }
  }

  async findByEmail(email: Email): Promise<User | null> {
    const manager = await this.connection.manager();
    const entity = await manager.findOne(UserOrmEntity, { where: { email: email.value } });
    return entity ? UserMapper.toDomain(entity) : null;
  }
}
