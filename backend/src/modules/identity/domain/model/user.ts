import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { Email } from '../../../../shared/domain/vo/email';
import { UserId } from '../../../../shared/domain/vo/user-id';
import { AccountType } from '../account-type';
import { IdentityEvent } from '../events/identity-events';

export interface UserState {
  readonly id: UserId;
  readonly email: Email;
  readonly passwordHash: string;
  readonly accountType: AccountType;
}

export class User extends AggregateRoot<IdentityEvent> {
  private constructor(private readonly state: UserState) {
    super();
  }

  static register(state: UserState): User {
    const user = new User(state);
    user.record({ type: 'UserRegistered', userId: state.id.value });
    return user;
  }

  static reconstitute(state: UserState): User {
    return new User(state);
  }

  get id(): UserId { return this.state.id; }
  get email(): Email { return this.state.email; }
  get passwordHash(): string { return this.state.passwordHash; }
  get accountType(): AccountType { return this.state.accountType; }
}
