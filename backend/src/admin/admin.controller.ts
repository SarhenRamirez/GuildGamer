import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import {
  AdminSessionQueryDto,
  AdminUpdateUserDto,
  AdminUserQueryDto,
} from './admin.dto.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query() query: AdminUserQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.admin.updateUser(id, dto, actor);
  }

  @Get('sessions')
  sessions(@Query() query: AdminSessionQueryDto) {
    return this.admin.listSessions(query);
  }
}
