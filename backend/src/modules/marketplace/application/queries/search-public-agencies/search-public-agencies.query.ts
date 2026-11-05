export interface SearchPublicAgenciesQuery {
  readonly q?: string;
  readonly city?: string;
  readonly district?: string;
  readonly capabilities?: readonly string[];
  readonly limit?: number;
  readonly cursor?: string;
}
