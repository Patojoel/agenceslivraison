import { CommandHandler } from '../../../../../shared/application/command-handler';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { Email } from '../../../../../shared/domain/vo/email';
import { UserId } from '../../../../../shared/domain/vo/user-id';
import { User } from '../../../domain/model/user';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { NewPassword } from '../../../domain/vo/new-password';
import { PasswordHasher } from '../../ports/password-hasher';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserResponse } from './register-user.response';

export class RegisterUserHandler implements CommandHandler<RegisterUserCommand, RegisterUserResponse> {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: RegisterUserCommand): Promise<RegisterUserResponse> {
    const email = Email.of(command.email);
    const password = NewPassword.of(command.password);
    const user = User.register({ id: UserId.of(this.ids.generate()), email, passwordHash: await this.hasher.hash(password), accountType: command.accountType });
    await this.users.add(user);
    await this.events.publish(user.pullEvents());
    return { id: user.id.value, accountType: user.accountType };
  }
}
