export const SQL_READER = Symbol('SqlReader');

/** Read side of the database for query handlers; joins the current transaction when there is one. */
export interface SqlReader {
  query<R extends object>(text: string, values: readonly unknown[]): Promise<R[]>;
}
