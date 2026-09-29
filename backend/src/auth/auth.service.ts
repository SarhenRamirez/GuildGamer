import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { privateUserSelect, withPremiumFlag } from '../users/user.select.js';
import { AuthProvider } from '../generated/prisma/enums.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { GoogleVerifier } from './google-verifier.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly google: GoogleVerifier,
  ) {}

  async loginWithGoogle(idToken: string) {
    const identity = await this.google.verify(idToken);

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: identity.googleId }, { email: identity.email }] },
      select: { id: true, googleId: true, isBanned: true },
    });
    if (user?.isBanned) throw new UnauthorizedException('Cuenta suspendida');

    if (user && !user.googleId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: identity.googleId },
      });
    }
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: identity.email,
          username: await this.freeUsername(identity.email.split('@')[0]),
          googleId: identity.googleId,
          authProvider: AuthProvider.GOOGLE,
          avatarUrl: identity.picture,
          subscription: { create: {} },
        },
        select: { id: true, googleId: true, isBanned: true },
      });
    }

    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: privateUserSelect,
    });
    return this.buildAuthResponse(withPremiumFlag(full));
  }

  private async freeUsername(seed: string) {
    const base =
      seed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 16) || 'gamer';
    const padded = base.length >= 3 ? base : `${base}_gz`;
    for (let n = 1; n < 1000; n++) {
      const candidate = n === 1 ? padded : `${padded}${n}`;
      const taken = await this.prisma.user.count({
        where: { username: { equals: candidate, mode: 'insensitive' } },
      });
      if (!taken) return candidate;
    }
    return `${padded.slice(0, 10)}${Date.now().toString(36).slice(-6)}`;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: { equals: dto.username, mode: 'insensitive' } },
        ],
      },
      select: { email: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email
          ? 'Ese email ya está registrado'
          : 'Ese nombre de usuario ya existe',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        subscription: { create: {} },
      },
      select: privateUserSelect,
    });
    return this.buildAuthResponse(withPremiumFlag(user));
  }

  async login(dto: LoginDto) {
    const found = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true, isBanned: true },
    });
    const valid =
      found?.passwordHash &&
      (await bcrypt.compare(dto.password, found.passwordHash));
    if (!found || !valid) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    if (found.isBanned) {
      throw new UnauthorizedException('Cuenta suspendida');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: found.id },
      select: privateUserSelect,
    });
    return this.buildAuthResponse(withPremiumFlag(user));
  }

  async verifyToken(token: string): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isBanned: true },
    });
    if (!user || user.isBanned) {
      throw new UnauthorizedException('Cuenta no disponible');
    }
    return { id: user.id, role: user.role };
  }

  private async buildAuthResponse<T extends { id: string; role: JwtPayload['role'] }>(
    user: T,
  ) {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}
