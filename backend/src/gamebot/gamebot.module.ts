import { Module } from '@nestjs/common';
import { GamebotController } from './gamebot.controller.js';
import { GamebotService } from './gamebot.service.js';

@Module({
  controllers: [GamebotController],
  providers: [GamebotService],
})
export class GamebotModule {}
