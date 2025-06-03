import {
  ChatMessage,
  serializeChatRequestMessage,
} from 'src/loadbalance/utils/serialize';
import axios, { AxiosResponse } from 'axios';

import { ERROR_CODE } from 'src/loadbalance/utils/server';
import { HttpException } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { Logger } from '@nestjs/common';

interface ChatCompletionRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  seed?: number;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  response_format?: { type: string };
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LoadBalancerContext {
  endpointList: string[];
  openaiKeyList: string[];
  logger: Logger;
  loadBalancer: ServerLoadBalancer;
  sendChatCompletionRequest: (
    endpoint: string,
    openaiKey: string,
    deploymentName: string,
    method: string,
    apiVersion: string,
    data: ChatCompletionRequest,
  ) => Promise<AxiosResponse>;
  handleRateLimitExceeded: (error: any) => Promise<void>;
  sendAzureOpenAIGetChatCompletions: (
    deploymentName: string,
    method: string,
    apiVersion: string,
    data: ChatCompletionRequest,
  ) => Promise<ChatCompletionResponse>;
}

interface ErrorResponse {
  response?: {
    status: number;
    data: {
      message?: string;
      error?: {
        code: string;
      };
    };
  };
  code?: string;
  message?: string;
}

interface ServerLoad {
  endpoint: string;
  deploymentName: string;
  requestCount: number;
}

export class ServerLoadBalancer {
  private serverLoads: ServerLoad[] = [];

  constructor(endpoints: string[], deploymentNames: string[]) {
    this.serverLoads = endpoints.flatMap((endpoint) =>
      deploymentNames.map((deploymentName) => ({
        endpoint,
        deploymentName,
        requestCount: 0,
      })),
    );
  }

  getLeastLoadedServer(deploymentName: string): {
    endpoint: string;
    deploymentName: string;
  } {
    const serversForDeployment = this.serverLoads.filter(
      (server) => server.deploymentName === deploymentName,
    );

    if (serversForDeployment.length === 0) {
      throw new Error(`No servers found for deployment: ${deploymentName}`);
    }

    const leastLoaded = serversForDeployment.reduce((prev, current) =>
      prev.requestCount < current.requestCount ? prev : current,
    );

    console.log(
      `Current server loads for deployment ${deploymentName}:`,
      serversForDeployment
        .map(
          (server) =>
            `${server.endpoint}(${server.deploymentName}): ${server.requestCount}`,
        )
        .join(', '),
    );
    console.log(
      'Selected server:',
      leastLoaded.endpoint,
      `(${leastLoaded.deploymentName})`,
      '(Requests:',
      leastLoaded.requestCount,
      ')',
    );

    return {
      endpoint: leastLoaded.endpoint,
      deploymentName: leastLoaded.deploymentName,
    };
  }

  incrementRequestCount(endpoint: string, deploymentName: string): void {
    const server = this.serverLoads.find(
      (s) => s.endpoint === endpoint && s.deploymentName === deploymentName,
    );
    if (server) {
      server.requestCount++;
      console.log(
        `Server ${endpoint}(${deploymentName}) requests increased to: ${server.requestCount}`,
      );
    }
  }

  decrementRequestCount(endpoint: string, deploymentName: string): void {
    const server = this.serverLoads.find(
      (s) => s.endpoint === endpoint && s.deploymentName === deploymentName,
    );
    if (server && server.requestCount > 0) {
      server.requestCount--;
      console.log(
        `Server ${endpoint}(${deploymentName}) requests decreased to: ${server.requestCount}`,
      );
    }
  }
}

export async function sendAzureOpenAIGetChatCompletions(
  this: LoadBalancerContext,
  deploymentName: string,
  method: string,
  apiVersion: string,
  data: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  // 가장 적은 요청을 받은 서버 선택
  const selectedEndpoint =
    this.loadBalancer.getLeastLoadedServer(deploymentName).endpoint;
  const selectedIndex = this.endpointList.indexOf(selectedEndpoint);

  try {
    this.logger.debug(`Selected endpoint: ${selectedEndpoint}`);
    this.loadBalancer.incrementRequestCount(selectedEndpoint, deploymentName);

    const result = await this.sendChatCompletionRequest(
      selectedEndpoint,
      this.openaiKeyList[selectedIndex],
      deploymentName,
      method,
      apiVersion,
      data,
    );

    if (result.data && result.status === 200) {
      return result.data as ChatCompletionResponse;
    }
  } catch (error: unknown) {
    const err = error as ErrorResponse;
    this.loadBalancer.decrementRequestCount(selectedEndpoint, deploymentName);

    if (err.code === 'ECONNABORTED') {
      this.logger.error('Request Timeout 발생');
      await this.handleRateLimitExceeded({
        response: {
          status: ERROR_CODE.NET_E_TOO_MANY_REQUESTS,
          data: { message: 'Request Timeout' },
        },
      });
      return this.sendAzureOpenAIGetChatCompletions(
        deploymentName,
        method,
        apiVersion,
        data,
      );
    }

    if (err.response) {
      // Content Filter 에러 처리
      if (
        err.response.status === 400 &&
        err.response.data.error?.code === 'content_filter'
      ) {
        this.logger.error(ERROR_CODE.NET_E_CONTENT_FILTER_UNSAFE);
        this.logger.error(err.response.data);
        throw new HttpException(
          err.response.data,
          ERROR_CODE.NET_E_CONTENT_FILTER_UNSAFE,
        );
      }

      // Rate Limit Exceeded(429) 에러 처리
      await this.handleRateLimitExceeded(err);
      return this.sendAzureOpenAIGetChatCompletions(
        deploymentName,
        method,
        apiVersion,
        data,
      );
    }

    // 기타 에러 처리
    this.logger.error(err.message || 'Unknown error occurred');
    throw error;
  }

  this.logger.error('All endpoints are failed');
  throw new HttpException(
    'i-Learning LoadBalancer: All endpoints are failed',
    ERROR_CODE.NET_E_TOO_MANY_REQUESTS,
  );
}

export async function sendChatCompletionRequest(
  endpoint: string,
  openaiKey: string,
  deploymentName: string,
  method: string,
  apiVersion: string,
  data: ChatCompletionRequest,
): Promise<AxiosResponse> {
  return await axios.post(
    `${endpoint}/openai/deployments/${deploymentName}/chat/${method}?api-version=${apiVersion}`,
    {
      messages: data.messages.map((message) =>
        serializeChatRequestMessage(message as ChatMessage),
      ),
      seed: data.seed,
      max_tokens: data.max_tokens,
      temperature: data.temperature,
      top_p: data.top_p,
      response_format: data.response_format,
      frequency_penalty: data.frequency_penalty,
      presence_penalty: data.presence_penalty,
    },
    {
      headers: {
        'api-key': `${openaiKey}`,
      },
      timeout: 30000,
    },
  );
}

export async function handleRateLimitExceeded(
  this: LoadBalancerContext,
  error: ErrorResponse,
): Promise<void> {
  if (error.response?.status === 429 || error.response?.status === 503) {
    this.logger.debug(
      'Rate Limit Exceeded or Service Unavailable, waiting for 1 second...',
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 지수 백오프로 변경 고려
  } else {
    this.logger.error(error.response?.status);
    this.logger.error(error.response?.data);
    throw new HttpException(
      error.response?.data.message || 'Unknown error occurred',
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
