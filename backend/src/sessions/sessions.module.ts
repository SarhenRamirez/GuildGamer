import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { SessionMembersController } from './session-members.controller.js';
import { SessionMembersService } from './session-members.service.js';
import { SessionSchedulerService } from './session-scheduler.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [ChatModule, NotificationsModule, FriendsModule, VoiceModule],
  controllers: [SessionsController, SessionMembersController],
  providers: [SessionsService, SessionMembersService, SessionSchedulerService],
})
export class SessionsModule {}
