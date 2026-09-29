import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { FriendsService } from './friends.service.js';

class FriendRequestDto {
  @IsUUID()
  userId: string;
}

@ApiTags('friends')
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.friends.list(user.id);
  }

  @Get('requests')
  requests(@CurrentUser() user: AuthUser) {
    return this.friends.requests(user.id);
  }

  @Post('request')
  request(@Body() dto: FriendRequestDto, @CurrentUser() user: AuthUser) {
    return this.friends.request(user, dto.userId);
  }

  @Post('requests/:id/accept')
  @HttpCode(200)
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.friends.accept(id, user);
  }

  @Post('requests/:id/reject')
  @HttpCode(204)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.friends.reject(id, user);
  }

  @Delete('requests/:id')
  @HttpCode(204)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.friends.cancelRequest(id, user);
  }

  @Post(':userId/block')
  @HttpCode(204)
  block(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: AuthUser) {
    return this.friends.block(user, userId);
  }

  @Delete(':userId/block')
  @HttpCode(204)
  unblock(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: AuthUser) {
    return this.friends.unblock(user, userId);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: AuthUser) {
    return this.friends.remove(user, userId);
  }
}
