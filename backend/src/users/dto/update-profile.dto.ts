import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  Availability,
  CommunicationPreference,
  SkillLevel,
} from '../../generated/prisma/enums.js';

const IMAGE_URL = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 20, { message: 'El usuario debe tener entre 3 y 20 caracteres' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'El usuario solo puede tener letras, números y guion bajo',
  })
  username?: string;

  @IsOptional()
  @IsUrl(IMAGE_URL, { message: 'avatarUrl debe ser una URL válida' })
  avatarUrl?: string;

  @IsOptional()
  @IsUrl(IMAGE_URL, { message: 'bannerUrl debe ser una URL válida' })
  bannerUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'accentColor debe ser un color #RRGGBB' })
  accentColor?: string;

  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^[a-z]{2}$/, { each: true, message: 'Idiomas en código ISO de 2 letras (es, en…)' })
  languages?: string[];

  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;

  @IsOptional()
  @IsEnum(CommunicationPreference)
  communicationPreference?: CommunicationPreference;
}
