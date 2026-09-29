import { Global, Module } from '@nestjs/common';
import { PremiumService } from './premium.service.js';

@Global()
@Module({
  providers: [PremiumService],
  exports: [PremiumService],
})
export class PremiumModule {}
