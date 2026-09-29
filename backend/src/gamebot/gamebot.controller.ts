import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { Public } from '../auth/decorators.js';
import { GamebotService } from './gamebot.service.js';

class AskDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  question: string;
}

@ApiTags('gamebot')
@Public()
@Controller('gamebot')
export class GamebotController {
  constructor(private readonly bot: GamebotService) {}

  @Post('ask')
  @HttpCode(200)
  ask(@Body() dto: AskDto) {
    return this.bot.ask(dto.question);
  }

  @Get('topics')
  topics() {
    return this.bot.topics();
  }
}
