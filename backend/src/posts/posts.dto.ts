import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PostKind } from '../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePostDto {
  @IsOptional()
  @Transform(trim)
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsEnum(PostKind)
  kind?: PostKind;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('all', { each: true })
  fileIds?: string[];
}

export class FeedQueryDto {
  @IsOptional()
  @IsIn(['all', 'friends'])
  feed: 'all' | 'friends' = 'all';

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsEnum(PostKind)
  kind?: PostKind;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  before?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class CreateCommentDto {
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  content: string;
}
