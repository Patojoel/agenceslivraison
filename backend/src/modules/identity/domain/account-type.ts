export const ACCOUNT_TYPES = ['individual', 'merchant'] as const;

export type AccountType = typeof ACCOUNT_TYPES[number];
