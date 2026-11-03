import { DomainEvent } from '@shared/domain/domain-event';

export type IdentityEvent =
  | { readonly type: 'UserRegistered'; readonly userId: string }
  | { readonly type: 'SessionOpened'; readonly userId: string; readonly sessionId: string }
  | { readonly type: 'SessionRefreshed'; readonly userId: string; readonly sessionId: string }
  | { readonly type: 'SessionRevoked'; readonly userId: string; readonly sessionId: string };

const TYPES: ReadonlySet<string> = new Set<IdentityEvent['type']>(['UserRegistered', 'SessionOpened', 'SessionRefreshed', 'SessionRevoked']);

export function isIdentityEvent(event: DomainEvent): event is IdentityEvent {
  return TYPES.has(event.type);
}
