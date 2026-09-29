import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { Platform } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateGameDto {
  @Transform(trim)
  @Length(1, 100)
  name: string;

  @Transform(trim)
  @Length(1, 50)
  genre: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Indica al menos una plataforma' })
  @IsEnum(Platform, { each: true })
  platforms: Platform[];

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  coverUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}

export class UpdateGameDto extends PartialType(CreateGameDto) {}

export class GameQueryDto {
  @IsOptional()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @MaxLength(50)
  genre?: string;
}
