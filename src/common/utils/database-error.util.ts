import { QueryFailedError } from 'typeorm';

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = (
    error as QueryFailedError & { driverError?: { code?: string } }
  ).driverError;

  return driverError?.code === '23505';
}
