import { QueryFailedError } from 'typeorm';

function driverCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }

  return (error as QueryFailedError & { driverError?: { code?: string } })
    .driverError?.code;
}

export function isUniqueViolation(error: unknown): boolean {
  return driverCode(error) === '23505';
}

export function isForeignKeyViolation(error: unknown): boolean {
  return driverCode(error) === '23503';
}
