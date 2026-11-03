import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../application/command-handler';
import { TypeOrmDatabaseConnection } from './typeorm-database-connection';

/** Controllers never call a handler directly: every SQL statement of a command, audit included, shares one transaction. */
@Injectable()
export class TransactionalCommandHandlerFactory {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  create<C, R>(handler: CommandHandler<C, R>): CommandHandler<C, R> {
    return { handle: command => this.connection.transaction(() => handler.handle(command)) };
  }
}
