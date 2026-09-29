import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CreateReviewDto, ReviewPageDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('sessions/:id/reviews')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.create(id, dto, user);
  }

  @Get('users/:id/reviews')
  forUser(@Param('id', ParseUUIDPipe) id: string, @Query() query: ReviewPageDto) {
    return this.reviews.forUser(id, query.page, query.limit);
  }

  @Get('reviews/pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.reviews.pending(user);
  }
}
