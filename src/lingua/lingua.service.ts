import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { encodingForModel } from 'js-tiktoken';

@Injectable()
export class LlmlinguaService implements OnModuleInit {
  private readonly logger = new Logger(LlmlinguaService.name);
  private tokenizer: any;

  async onModuleInit() {
    try {
      // 가벼운 토크나이저만 사용
      this.tokenizer = encodingForModel('gpt-3.5-turbo');
      this.logger.log(
        'LlmlinguaService initialized with fallback compression method',
      );
    } catch (error) {
      this.logger.error('Failed to initialize tokenizer:', error);
      throw error;
    }
  }

  async compressText(input: string, rate = 0.5): Promise<string> {
    try {
      // 간단한 텍스트 압축 방법 사용
      return this.simpleCompress(input, rate);
    } catch (error) {
      this.logger.warn(
        'Text compression failed, returning original text:',
        error,
      );
      return input;
    }
  }

  private simpleCompress(text: string, rate: number): string {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length <= 1) {
      return text;
    }

    // 중요하지 않은 문장들을 제거
    const keepCount = Math.max(1, Math.floor(sentences.length * rate));

    // 문장 길이와 핵심 키워드 기반으로 중요도 계산
    const sentenceScores = sentences.map((sentence, index) => {
      const trimmed = sentence.trim();
      let score = trimmed.length; // 길이 기반 점수

      // 핵심 키워드가 포함된 문장에 가산점
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
      ];
      const keywordBonus = keywords.some((keyword) =>
        trimmed.toLowerCase().includes(keyword),
      )
        ? 50
        : 0;

      // 첫 번째와 마지막 문장에 가산점
      const positionBonus =
        index === 0 || index === sentences.length - 1 ? 30 : 0;

      return {
        sentence: trimmed,
        score: score + keywordBonus + positionBonus,
        index,
      };
    });

    // 점수 기준으로 정렬하고 상위 문장들 선택
    const selectedSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, keepCount)
      .sort((a, b) => a.index - b.index) // 원래 순서로 재정렬
      .map((item) => item.sentence);

    return selectedSentences.join('. ') + '.';
  }
}
