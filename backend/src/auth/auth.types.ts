import type { Role } from '../generated/prisma/enums.js';

export interface JwtPayload {
  sub: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  role: Role;
}
