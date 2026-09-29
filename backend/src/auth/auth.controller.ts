import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { AuthService } from './auth.service.js';
import { Public } from './decorators.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { GoogleVerifier } from './google-verifier.js';

class GoogleLoginDto {
  @IsString()
  @MaxLength(4096)
  idToken: string;
}

@Public()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleVerifier,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('google')
  @HttpCode(200)
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Get('providers')
  providers() {
    return {
      google: this.google.enabled,
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    };
  }
}
