import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  JoinMode,
  Platform,
  SessionKind,
  SessionStatus,
  SkillLevel,
} from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateSessionDto {
  @Transform(trim)
  @Length(3, 100)
  title: string;

  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  gameId: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsOptional()
  @MaxLength(50)
  mode?: string;

  @IsOptional()
  @IsEnum(SessionKind)
  kind?: SessionKind;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers: number;

  @IsEnum(SkillLevel)
  skillLevel: SkillLevel;

  @IsOptional()
  @Matches(/^[a-z]{2}$/, { message: 'Idioma en código ISO de 2 letras (es, en…)' })
  language?: string;

  @IsOptional()
  @IsBoolean()
  micRequired?: boolean;

  @IsOptional()
  @IsEnum(JoinMode)
  joinMode?: JoinMode;

  @Type(() => Date)
  @IsDate({ message: 'startsAt debe ser una fecha ISO válida' })
  startsAt: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @MaxLength(500)
  joinInfo?: string;
}

export class UpdateSessionDto extends PartialType(
  OmitType(CreateSessionDto, ['gameId', 'platform', 'kind'] as const),
) {}

export class SessionQueryDto {
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  language?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  micRequired?: boolean;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsEnum(SessionKind)
  kind?: SessionKind;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
