import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleVerifier {
  private readonly clientId?: string;
  private readonly client = new OAuth2Client();

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined;
  }

  get enabled() {
    return !!this.clientId;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.clientId) {
      throw new ServiceUnavailableException(
        'El login con Google no está configurado (falta GOOGLE_CLIENT_ID)',
      );
    }
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google no válido');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('La cuenta de Google no tiene un email verificado');
    }
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
      picture: payload.picture,
    };
  }
}
