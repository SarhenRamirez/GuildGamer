import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { PaymentsService } from './payments.service.js';

class SimulateDto {
  @IsIn(['success', 'failure'])
  outcome: 'success' | 'failure';
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.payments.plans();
  }

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.payments.mySubscription(user);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser) {
    return this.payments.checkout(user);
  }

  @Post(':id/simulate')
  @HttpCode(200)
  simulate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimulateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.simulate(id, dto.outcome, user);
  }

  @Post('cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser) {
    return this.payments.cancel(user);
  }

  @Public()
  @ApiExcludeEndpoint()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.payments.handleStripeWebhook(req.rawBody, signature);
  }
}
