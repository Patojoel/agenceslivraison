import { AggregateRoot } from '@shared/domain/aggregate-root';
import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AccountType } from './account-type';
import { IdentityEvent } from './events/identity-events';
import { UserSnapshot } from './user.snapshot';

export class User extends AggregateRoot<IdentityEvent> {
  private constructor(private readonly state: UserSnapshot) {
    super();
  }

  static register(state: UserSnapshot): User {
    const user = new User(state);
    user.record({ type: 'UserRegistered', userId: state.id.value });
    return user;
  }

  static reconstitute(state: UserSnapshot): User {
    return new User(state);
  }

  get id(): UserId { return this.state.id; }
  get email(): Email { return this.state.email; }
  get passwordHash(): string { return this.state.passwordHash; }
  get accountType(): AccountType { return this.state.accountType; }
}
