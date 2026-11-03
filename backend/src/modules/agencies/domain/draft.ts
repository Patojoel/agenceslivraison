export class AgencyInputError extends Error {}
export interface AgencyDraft { readonly name: string; readonly status: 'draft' }
export function createDraft(name: string): AgencyDraft {
  const normalized = name.trim();
  if (!normalized || normalized.length > 160) throw new AgencyInputError('Invalid agency name');
  return { name: normalized, status: 'draft' };
}
