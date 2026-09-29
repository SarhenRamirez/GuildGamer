import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [ChatModule, NotificationsModule, VoiceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
