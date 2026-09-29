import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateReportDto, ReportQueryDto, ResolveReportDto } from './reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('reports')
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.create(dto, user);
  }

  @Get('reports/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.reports.mine(user);
  }

  @ApiTags('admin')
  @Roles(Role.ADMIN)
  @Get('admin/reports')
  list(@Query() query: ReportQueryDto) {
    return this.reports.list(query);
  }

  @ApiTags('admin')
  @Roles(Role.ADMIN)
  @Patch('admin/reports/:id')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.resolve(id, dto, user);
  }
}
