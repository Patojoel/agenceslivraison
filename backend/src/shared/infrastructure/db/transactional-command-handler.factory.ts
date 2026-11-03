import { CommandHandler } from '../../application/command-handler';
import { Database } from './database';

export class TransactionalCommandHandlerFactory {
  constructor(private readonly database: Database) {}

  create<C, R>(handler: CommandHandler<C, R>): CommandHandler<C, R> {
    return { handle: command => this.database.transaction(() => handler.handle(command)) };
  }
}
