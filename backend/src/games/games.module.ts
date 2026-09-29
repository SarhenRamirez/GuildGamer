import { Module } from '@nestjs/common';
import { CoversService } from './covers.service.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

@Module({
  controllers: [GamesController],
  providers: [GamesService, CoversService],
})
export class GamesModule {}
