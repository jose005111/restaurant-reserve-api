import { ValidateIf } from 'class-validator';

/** Optional fields backed by NOT NULL columns must still reject explicit null. */
export const OptionalField = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
