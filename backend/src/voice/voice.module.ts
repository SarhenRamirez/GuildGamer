import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceGateway } from './voice.gateway.js';
import { VoiceService } from './voice.service.js';

@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceGateway],
  exports: [VoiceGateway],
})
export class VoiceModule {}
