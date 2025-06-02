import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ERROR_CODE, ERROR_MESSAGE } from '../network.status.constants';

@Injectable()
export class LoadBalancingService {
  private readonly logger = new Logger(LoadBalancingService.name);
  constructor() {}

  // 엔드포인트 주소 목록
  endpointList: string[] = [
    process.env.OPENAI_ENDPOINT1,
    process.env.OPENAI_ENDPOINT2,
    process.env.OPENAI_ENDPOINT3,
    process.env.OPENAI_ENDPOINT4,
    process.env.OPENAI_ENDPOINT5,
    process.env.OPENAI_ENDPOINT6,
    process.env.OPENAI_ENDPOINT7,
    process.env.OPENAI_ENDPOINT8,
    process.env.OPENAI_ENDPOINT9,
    process.env.OPENAI_ENDPOINT10,
  ];

  // OpenAI 키 목록
  openaiKeyList: string[] = [
    process.env.OPENAI_KEY1,
    process.env.OPENAI_KEY2,
    process.env.OPENAI_KEY3,
    process.env.OPENAI_KEY4,
    process.env.OPENAI_KEY5,
    process.env.OPENAI_KEY6,
    process.env.OPENAI_KEY7,
    process.env.OPENAI_KEY8,
    process.env.OPENAI_KEY9,
    process.env.OPENAI_KEY10,
  ];

  // 해당 함수 내에서 토큰 및 모니터링을 위한 데이터 수집 로직을 추가 해야합니다.(DB 설계 이후)
  async sendAzureOpenAIGetChatCompletions(
    deploymentName: string,
    method: string,
    apiVersion: string,
    data: any,
  ) {
    for (let i = 0; i < this.endpointList.length; i++) {
      try {
        this.logger.debug(`Retry ${i}th endpoint`);
        this.logger.debug(this.endpointList[i]);

        const result = await this.sendChatCompletionRequest(
          this.endpointList[i],
          this.openaiKeyList[i],
          deploymentName,
          method,
          apiVersion,
          data,
        );

        if (result.data && result.status === 200) {
          return result.data;
        }
      } catch (error) {
        // 타임아웃 에러 처리: error.code가 'ECONNABORTED' 인 경우
        if (error.code === 'ECONNABORTED') {
          this.logger.error('Request Timeout 발생');
          await this.handleRateLimitExceeded({
            response: {
              status: ERROR_CODE.NET_E_TOO_MANY_REQUESTS,
              data: { message: 'Request Timeout' },
            },
          });
          continue;
        }

        if (error.response) {
          // Content Filter 에러 처리
          if (
            error.response.status === 400 &&
            error.response.data.error.code === 'content_filter'
          ) {
            this.logger.error(
              ERROR_MESSAGE(ERROR_CODE.NET_E_CONTENT_FILTER_UNSAFE),
            );
            this.logger.error(error.response.data);
            throw new HttpException(
              error.response.data,
              ERROR_CODE.NET_E_CONTENT_FILTER_UNSAFE,
            );
          }

          // Rate Limit Exceeded(429) 에러 처리
          await this.handleRateLimitExceeded(error);
          continue;
        }

        // 기타 에러 처리
        this.logger.error(error.message);
        throw error;
      }
    }

    this.logger.error('All endpoints are failed');
    throw new HttpException(
      'i-Learning LoadBalancer: All endpoints are failed',
      ERROR_CODE.NET_E_TOO_MANY_REQUESTS,
    );
  }

  async sendChatCompletionRequest(
    endpoint: string,
    openaiKey: string,
    deploymentName: string,
    method: string,
    apiVersion: string,
    data: any,
  ) {
    return await axios.post(
      `${endpoint}/openai/deployments/${deploymentName}/chat/${method}?api-version=${apiVersion}`,
      {
        messages: data.messages.map((message) =>
          serializeChatRequestMessage(message),
        ), // OpenAI 공식 라이브러리처럼 동일하게 messages 직렬화
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

  async handleRateLimitExceeded(error: any) {
    if (
      error.response.status === ERROR_CODE.NET_E_TOO_MANY_REQUESTS ||
      error.response.status === HttpStatus.SERVICE_UNAVAILABLE
    ) {
      this.logger.debug(
        'Rate Limit Exceeded or Service Unavailable, waiting for 1 second...',
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 지수 백오프로 변경 고려
    } else {
      this.logger.error(error.response.status);
      this.logger.error(error.response.data);
      throw new HttpException(
        error.response.data.message,
        error.response.status,
      );
    }
  }
}

// 아래는 OpenAI API의 메시지 직렬화를 위한 serializeChatRequestMessage 함수와 관련 함수들입니다.
type Message = {
  content?: string | null;
  role: string;
  functionCall?: any;
  toolCalls?: any[];
  [key: string]: any; // 동적 속성을 위해 인덱스 시그니처 추가
};

function serializeChatRequestMessage(message: Message): object {
  if (message.content === undefined) {
    message.content = null;
  }
  switch (message.role) {
    case 'assistant': {
      const { functionCall, toolCalls, ...rest } = message;
      return {
        ...snakeCaseKeys(rest),
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        ...(functionCall ? { function_call: functionCall } : {}),
      };
    }
    default: {
      return snakeCaseKeys(message);
    }
  }
}

function snakeCaseKeys(obj: any): any {
  if (typeof obj !== 'object' || !obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map((v) => snakeCaseKeys(v));
  } else {
    const newObj: { [key: string]: any } = {};
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const newKey = toSnakeCase(key);
      newObj[newKey] = typeof value === 'object' ? snakeCaseKeys(value) : value;
    });
    return newObj;
  }
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (group) => `_${group.toLowerCase()}`)
    .replace(/^_/, '');
}
