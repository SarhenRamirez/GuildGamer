import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { SessionMembersService } from './session-members.service.js';

@ApiTags('sessions')
@Controller('sessions/:id')
export class SessionMembersController {
  constructor(private readonly members: SessionMembersService) {}

  @Post('join')
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.join(id, user);
  }

  @Delete('leave')
  @HttpCode(204)
  leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.leave(id, user);
  }

  @Post('invite/:userId')
  @HttpCode(200)
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.invite(id, userId, user);
  }

  @Post('members/:userId/accept')
  @HttpCode(200)
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.accept(id, userId, user);
  }

  @Post('members/:userId/reject')
  @HttpCode(204)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.reject(id, userId, user);
  }

  @Delete('members/:userId')
  @HttpCode(204)
  kick(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.kick(id, userId, user);
  }
}
