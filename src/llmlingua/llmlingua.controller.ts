import { Body, Controller, Post } from '@nestjs/common';
import { LlmlinguaRequestDto } from './dto/llmlingua-request.dto';
import { LlmlinguaService } from './llmlingua.service';

@Controller('llmlingua')
export class LlmlinguaController {
  constructor(private readonly llmlinguaService: LlmlinguaService) {}

  @Post('compress')
  async compress(@Body() body: LlmlinguaRequestDto) {
    const result = await this.llmlinguaService.compressText(
      body.text,
      body.rate,
    );
    return { compressed: result };
  }
}
