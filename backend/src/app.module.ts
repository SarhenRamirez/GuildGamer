import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { FilesModule } from './files/files.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { GamebotModule } from './gamebot/gamebot.module.js';
import { GamesModule } from './games/games.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PremiumModule } from './premium/premium.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { UsersModule } from './users/users.module.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    PremiumModule,
    AuthModule,
    UsersModule,
    GamesModule,
    SessionsModule,
    ChatModule,
    NotificationsModule,
    FriendsModule,
    ReviewsModule,
    ReportsModule,
    FilesModule,
    PostsModule,
    PaymentsModule,
    GamebotModule,
    VoiceModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
