import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { LLMLingua2 } from '@atjsh/llmlingua-2';
import { encodingForModel } from 'js-tiktoken';

@Injectable()
export class LlmlinguaService implements OnModuleInit {
  private readonly logger = new Logger(LlmlinguaService.name);
  private compressor: LLMLingua2.PromptCompressor;
  private tokenizer: any;
  private llmLinguaAvailable = false;

  async onModuleInit() {
    try {
      // Initialize tokenizer
      this.tokenizer = encodingForModel('gpt-3.5-turbo');

      // Try to initialize LLMLingua-2
      try {
        const { promptCompressor } = await LLMLingua2.WithXLMRoBERTa(
          'atjsh/llmlingua-2-js-xlm-roberta-large-meetingbank',
          {
            transformerJSConfig: {
              device: 'auto',
              dtype: 'fp32',
            },
            oaiTokenizer: this.tokenizer,
            modelSpecificOptions: {
              use_external_data_format: true,
            },
          },
        );

        this.compressor = promptCompressor;
        this.llmLinguaAvailable = true;
        this.logger.log(
          'LlmlinguaService initialized successfully with LLMLingua-2',
        );
      } catch (initError: any) {
        this.logger.warn(
          'Failed to initialize LLMLingua-2, falling back to simple compression:',
          initError.message,
        );
        this.llmLinguaAvailable = false;
      }
    } catch (error) {
      this.logger.error('Failed to initialize LlmlinguaService:', error);
      this.logger.warn('Using simple compression method only');
      this.llmLinguaAvailable = false;
    }
  }

  async compressText(input: string, rate = 0.5): Promise<string> {
    // First try LLMLingua-2 if available
    if (this.llmLinguaAvailable && this.compressor) {
      try {
        const compressedText = await this.compressor.compress_prompt(input, {
          rate,
        });

        // Calculate compression statistics
        const originalTokens = this.tokenizer.encode(input).length;
        const compressedTokens = this.tokenizer.encode(compressedText).length;
        const tokenReduction = (
          (1 - compressedTokens / originalTokens) *
          100
        ).toFixed(1);

        this.logger.debug(
          `LLMLingua-2 compression: ${input.length} -> ${compressedText.length} chars, ` +
            `${originalTokens} -> ${compressedTokens} tokens (${tokenReduction}% reduction)`,
        );

        return compressedText;
      } catch (error) {
        this.logger.warn(
          'LLMLingua-2 compression failed, falling back to simple compression:',
          error,
        );
      }
    }

    // Fallback to simple compression
    this.logger.debug('Using simple compression method');
    return this.simpleCompress(input, rate);
  }

  private simpleCompress(text: string, rate: number): string {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length <= 1) {
      return text;
    }

    // Keep important sentences based on rate
    const keepCount = Math.max(1, Math.floor(sentences.length * rate));

    // Calculate sentence importance scores
    const sentenceScores = sentences.map((sentence, index) => {
      const trimmed = sentence.trim();
      let score = trimmed.length; // Length-based score

      // Bonus for sentences with key words
      const keywords = [
        'important',
        'key',
        'main',
        'primary',
        'essential',
        'critical',
        'must',
        'should',
        'required',
        'please',
        'note',
        'remember',
      ];
      const keywordBonus = keywords.some((keyword) =>
        trimmed.toLowerCase().includes(keyword),
      )
        ? 50
        : 0;

      // Bonus for first and last sentences
      const positionBonus =
        index === 0 || index === sentences.length - 1 ? 30 : 0;

      return {
        sentence: trimmed,
        score: score + keywordBonus + positionBonus,
        index,
      };
    });

    // Select top sentences and maintain original order
    const selectedSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, keepCount)
      .sort((a, b) => a.index - b.index)
      .map((item) => item.sentence);

    return selectedSentences.join('. ') + '.';
  }

  // Method to check if LLMLingua-2 is available
  isLLMLinguaAvailable(): boolean {
    return this.llmLinguaAvailable && !!this.compressor;
  }

  // Method to get compression method being used
  getCompressionMethod(): string {
    return this.isLLMLinguaAvailable() ? 'LLMLingua-2' : 'Simple Fallback';
  }
}
