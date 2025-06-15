import { Module } from '@nestjs/common';
import { LlmlinguaController } from './llmlingua.controller';
import { LlmlinguaService } from './llmlingua.service';

@Module({
  controllers: [LlmlinguaController],
  providers: [LlmlinguaService],
})
export class LlmlinguaModule {}
