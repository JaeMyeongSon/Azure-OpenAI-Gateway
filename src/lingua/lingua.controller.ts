import { Controller, Post, Body } from '@nestjs/common';
import { LlmlinguaService } from './lingua.service';

@Controller('llmlingua')
export class LlmlinguaController {
  constructor(private readonly llmlinguaService: LlmlinguaService) {}

  @Post('compress')
  async compress(@Body() body: { text: string; budget?: number }) {
    const result = await this.llmlinguaService.compressText(
      body.text,
      body.budget || 200,
    );
    return { compressed: result };
  }
}
