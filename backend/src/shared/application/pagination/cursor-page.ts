/** List contract of the API: stable keyset pagination, never offsets. */
export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

/** `rows` must have been fetched with `limit + 1` to detect a following page. */
export const buildCursorPage = <T>(rows: readonly T[], limit: number, cursorOf: (item: T) => string): CursorPage<T> => {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const hasMore = rows.length > limit;
  return { items, hasMore, nextCursor: hasMore && last !== undefined ? cursorOf(last) : null };
};
