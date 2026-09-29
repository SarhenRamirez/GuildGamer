import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [FilesModule, FriendsModule, NotificationsModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
