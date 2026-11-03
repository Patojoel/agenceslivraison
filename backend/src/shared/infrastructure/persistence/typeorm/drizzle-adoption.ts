/**
 * What the previous Drizzle releases left in `drizzle.__drizzle_migrations`: `hash` is the SHA-256 of
 * each SQL file and `createdAt` the `when` of `meta/_journal.json`, exactly what Drizzle compared.
 */
export const EXPECTED_DRIZZLE_HISTORY: readonly { hash: string; createdAt: number }[] = [
  { hash: 'da5829e0820851f496d1683d1143b644bb5e5ec7419a1f50a3c9aaeffbbfb137', createdAt: 1760000000000 },
  { hash: '7dfa395e39be4024c09c7ce9482a32e4d4583d46eaba9ff3e66d1b48769ed479', createdAt: 1793709557462 },
  { hash: 'cf5ec8955a1b363c59b684483ac53f209b68ac578d787a5f3363e24e865ab738', createdAt: 1793709564930 },
  { hash: 'e9e3a98f700e695c5d976cad5101bf1b3aff397949e2c6bc8af461367ff9300b', createdAt: 1793709733848 },
  { hash: '5f121646a757981946efc6001a53ce26257fccfd451f002a6c4ac94875df1af6', createdAt: 1793710641406 },
  { hash: '0e7fa61a8500a90b1ac3dedebb59e1d76750a9885d35a832429a421e983abde3', createdAt: 1793710652830 },
  { hash: 'aa514d29471bfaa516e17f640f18288df59ab9515d62aad028edf1adbffbf61f', createdAt: 1793710789928 },
];

/** Unique indexes the application relies on for its invariants. */
export const CRITICAL_UNIQUE_INDEXES: readonly string[] = [
  'users_email_unique',
  'sessions_token_digest_unique',
  'agency_memberships_agency_user_unique',
  'agency_invitations_token_unique',
];

export interface DrizzleHistoryRow {
  hash: string;
  created_at: string | number;
}

/** Returns why an existing Drizzle database cannot be adopted as is, or null when it can. No data is echoed. */
export function findDrizzleAdoptionProblem(history: readonly DrizzleHistoryRow[], uniqueIndexes: readonly string[]): string | null {
  const matches = history.length === EXPECTED_DRIZZLE_HISTORY.length
    && history.every((row, position) => {
      const expected = EXPECTED_DRIZZLE_HISTORY[position];
      return expected !== undefined && row.hash === expected.hash && Number(row.created_at) === expected.createdAt;
    });
  if (!matches) return 'The Drizzle migration history differs from the expected one: apply every Drizzle migration with the previous release first';
  const missing = CRITICAL_UNIQUE_INDEXES.filter(name => !uniqueIndexes.includes(name));
  if (missing.length) return `Missing unique indexes: ${missing.join(', ')}`;
  return null;
}
