export function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function emptyToNull(value: unknown): unknown {
  const trimmed = trimString(value);
  return trimmed === '' ? null : trimmed;
}

export function emptyToUndefined(value: unknown): unknown {
  const trimmed = trimString(value);
  return trimmed === '' ? undefined : trimmed;
}
