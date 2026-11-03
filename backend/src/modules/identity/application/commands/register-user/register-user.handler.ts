import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user.repository';
import { User } from '../../../domain/user';
import { NewPassword } from '../../../domain/value-objects/new-password';
import { PASSWORD_HASHER, PasswordHasher } from '../../ports/password-hasher.port';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserResponse } from './register-user.response';

@Injectable()
export class RegisterUserHandler implements CommandHandler<RegisterUserCommand, RegisterUserResponse> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: RegisterUserCommand): Promise<RegisterUserResponse> {
    const email = Email.of(command.email);
    const password = NewPassword.of(command.password);
    const user = User.register({ id: UserId.of(this.uuid.generate()), email, passwordHash: await this.hasher.hash(password), accountType: command.accountType });
    await this.users.add(user);
    await this.events.publish(user.pullEvents());
    return { id: user.id.value, accountType: user.accountType };
  }
}
