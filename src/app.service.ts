import {
  ChatCompletionResponse,
  handleRateLimitExceeded,
  sendAzureOpenAIGetChatCompletions,
  sendChatCompletionRequest,
  ServerLoadBalancer,
} from './loadbalance/loadbalance.core';
import { Injectable, Logger } from '@nestjs/common';
import { LlmlinguaService } from './lingua/lingua.service';
import { encodingForModel } from 'js-tiktoken';

import { ChatCompletionRequest } from './dto/chat.dto';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly endpointList =
    process.env.AZURE_OPENAI_ENDPOINTS?.split(',') || [];
  private readonly openaiKeyList =
    process.env.AZURE_OPENAI_KEYS?.split(',') || [];
  private readonly deploymentNames = [
    'feedback-01',
    'feedback-02',
    'feedback-03',
  ];
  private readonly apiVersion =
    process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
  private readonly loadBalancer: ServerLoadBalancer;
  private currentDeploymentIndex = 0;
  private readonly tokenizer = encodingForModel('gpt-3.5-turbo');

  // Token compression 설정
  private readonly enableCompression =
    process.env.ENABLE_TOKEN_COMPRESSION === 'true';
  private readonly compressionRate = parseFloat(
    process.env.TOKEN_COMPRESSION_RATE || '0.4',
  );
  private readonly minContentLength = parseInt(
    process.env.MIN_COMPRESSION_LENGTH || '100',
  );

  constructor(private readonly llmlinguaService: LlmlinguaService) {
    if (!this.endpointList.length || !this.openaiKeyList.length) {
      throw new Error('Azure OpenAI endpoints and keys must be configured');
    }
    this.loadBalancer = new ServerLoadBalancer(
      this.endpointList,
      this.deploymentNames,
    );
  }

  getHello(): string {
    return 'Hello World!';
  }

  private getNextDeploymentName(): string {
    const deploymentName = this.deploymentNames[this.currentDeploymentIndex];
    this.currentDeploymentIndex =
      (this.currentDeploymentIndex + 1) % this.deploymentNames.length;
    return deploymentName;
  }

  async postMessage(request: ChatCompletionRequest): Promise<string> {
    let compressedRequest = { ...request };

    // Token compressing 적용 (환경변수 또는 요청별 설정으로 제어)
    const shouldCompress = request.enable_compression ?? this.enableCompression;
    const compressionRate = request.compression_rate ?? this.compressionRate;

    if (shouldCompress) {
      this.logger.log(
        `Applying token compression with rate: ${compressionRate}`,
      );

      const compressedMessages = await Promise.all(
        request.messages.map(async (message) => {
          // 최소 길이보다 긴 메시지만 압축
          if (message.content.length < this.minContentLength) {
            return message;
          }

          try {
            const compressedContent = await this.llmlinguaService.compressText(
              message.content,
              compressionRate,
            );

            // 토큰 개수 계산
            const originalTokens = this.tokenizer.encode(
              message.content,
            ).length;
            const compressedTokens =
              this.tokenizer.encode(compressedContent).length;
            const tokenReduction = (
              (1 - compressedTokens / originalTokens) *
              100
            ).toFixed(1);

            this.logger.log(
              `Message compressed [${message.role}]: ${message.content.length} -> ${compressedContent.length} chars (${((1 - compressedContent.length / message.content.length) * 100).toFixed(1)}% reduction), ${originalTokens} -> ${compressedTokens} tokens (${tokenReduction}% reduction)`,
            );

            return { ...message, content: compressedContent };
          } catch (error) {
            this.logger.warn(
              `Token compression failed for ${message.role} message:`,
              error,
            );
            return message;
          }
        }),
      );

      compressedRequest.messages = compressedMessages;

      // 압축 관련 필드 제거 (Azure OpenAI API로 전송하지 않음)
      delete compressedRequest.enable_compression;
      delete compressedRequest.compression_rate;
    } else {
      // 압축하지 않는 경우에도 필드 제거
      delete compressedRequest.enable_compression;
      delete compressedRequest.compression_rate;
    }

    const deploymentName = this.getNextDeploymentName();
    const context = {
      endpointList: this.endpointList,
      openaiKeyList: this.openaiKeyList,
      logger: this.logger,
      loadBalancer: this.loadBalancer,
      sendChatCompletionRequest,
      handleRateLimitExceeded,
      sendAzureOpenAIGetChatCompletions,
    };

    try {
      const response = (await sendAzureOpenAIGetChatCompletions.call(
        context,
        deploymentName,
        'completions',
        this.apiVersion,
        compressedRequest,
      )) as ChatCompletionResponse;

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from Azure OpenAI');
      }

      return response.choices[0].message.content;
    } catch (error) {
      this.logger.error(
        `Error in postMessage (deployment: ${deploymentName}):`,
        error,
      );
      throw error;
    }
  }
}
