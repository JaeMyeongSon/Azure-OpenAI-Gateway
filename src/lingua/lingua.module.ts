import { Module } from '@nestjs/common';
import { LlmlinguaService } from './lingua.service';
import { LlmlinguaController } from './lingua.controller';

@Module({
  controllers: [LlmlinguaController],
  providers: [LlmlinguaService],
  exports: [LlmlinguaService],
})
export class LlmlinguaModule {}
