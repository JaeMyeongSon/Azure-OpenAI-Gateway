import {
  ChatCompletionResponse,
  handleRateLimitExceeded,
  sendAzureOpenAIGetChatCompletions,
  sendChatCompletionRequest,
  ServerLoadBalancer,
} from './loadbalance/loadbalance.core';
import { Injectable, Logger } from '@nestjs/common';

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

  constructor() {
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
        request,
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
