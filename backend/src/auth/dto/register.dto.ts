import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email no válido' })
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 20, { message: 'El usuario debe tener entre 3 y 20 caracteres' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'El usuario solo puede tener letras, números y guion bajo',
  })
  username: string;

  @IsString()
  @Length(8, 72, { message: 'La contraseña debe tener entre 8 y 72 caracteres' })
  password: string;
}
