import { LLMLingua2 } from '@atjsh/llmlingua-2';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { encodingForModel } from 'js-tiktoken';

@Injectable()
export class LlmlinguaService implements OnModuleInit {
  // constructor(private readonly configService: ConfigService) {}
  private compressor: LLMLingua2.PromptCompressor;

  async onModuleInit() {
    const oaiTokenizer = encodingForModel('gpt-3.5-turbo');
    // const modelName = this.configService.getOrThrow('LLMLINGUA_MODEL_NAME');
    const modelName = 'Arcoldd/llmlingua4j-bert-base-onnx';

    const { promptCompressor } = await LLMLingua2.WithBERTMultilingual(
      modelName,
      {
        transformerJSConfig: {
          device: 'auto',
          dtype: 'fp32',
        },
        oaiTokenizer: oaiTokenizer,
        modelSpecificOptions: {
          subfolder: '',
          // use_external_data_format: true,
        },
      },
    );
    this.compressor = promptCompressor;
  }

  async compressText(input: string, rate: number): Promise<string> {
    return await this.compressor.compress_prompt(input, { rate });
  }
}
