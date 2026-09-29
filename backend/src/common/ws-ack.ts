import { HttpException, type Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';

export type Ack<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export class WsUserError extends Error {}

const isUserFacing = (e: unknown) =>
  e instanceof WsUserError || e instanceof HttpException;

export async function wsHandle<T = void>(
  logger: Logger,
  fn: () => Promise<T>,
): Promise<Ack<T>> {
  try {
    const data = await fn();
    return data === undefined ? { ok: true } : { ok: true, data };
  } catch (e) {
    if (!isUserFacing(e)) logger.error(e);
    return {
      ok: false,
      error: isUserFacing(e) ? (e as Error).message : 'Error inesperado',
    };
  }
}

export function requireUuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !isUUID(value)) {
    throw new WsUserError(`${field} no válido`);
  }
  return value;
}
