/** Escape LIKE metacharacters while retaining a case-insensitive contains search. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/** Query booleans must not use implicit Boolean('false') coercion. */
export function queryBoolean(value: unknown): unknown {
  return value === 'true' ? true : value === 'false' ? false : value;
}
