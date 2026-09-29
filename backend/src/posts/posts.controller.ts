import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CreateCommentDto, CreatePostDto, FeedQueryDto } from './posts.dto.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthUser) {
    return this.posts.create(dto, user);
  }

  @Get()
  feed(@Query() query: FeedQueryDto, @CurrentUser() user: AuthUser) {
    return this.posts.feed(query, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.findOne(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.remove(id, user);
  }

  @Post(':id/like')
  @HttpCode(200)
  like(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.like(id, user);
  }

  @Delete(':id/like')
  unlike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.posts.unlike(id, user);
  }

  @Get(':id/comments')
  comments(@Param('id', ParseUUIDPipe) id: string) {
    return this.posts.comments(id);
  }

  @Post(':id/comments')
  comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posts.comment(id, dto, user);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(204)
  removeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posts.removeComment(id, commentId, user);
  }
}
