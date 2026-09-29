import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Platform, SkillLevel } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class UpsertUserGameDto {
  @IsUUID()
  gameId: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsOptional()
  @MaxLength(50)
  gamerTag?: string;

  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @IsOptional()
  @Transform(trim)
  @MaxLength(40)
  rank?: string | null;

  @IsOptional()
  @Transform(trim)
  @MaxLength(40)
  role?: string | null;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
