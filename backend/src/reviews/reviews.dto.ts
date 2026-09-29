import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReviewTag } from '../generated/prisma/enums.js';

export class CreateReviewDto {
  @IsUUID()
  targetId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(ReviewTag, { each: true })
  tags?: ReviewTag[];

  @IsOptional()
  @MaxLength(500)
  comment?: string;
}

export class ReviewPageDto {
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
