import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  HttpException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { LoadBalancingService } from './load-balancing.service';

@Controller('load-balancing')
export class LoadBalancingController {
    constructor(private readonly loadBalancingService: LoadBalancingService) {}

  @Post('chat/completions')
  async createChatCompletion(@Body() requestBody: any) {
      try {
          const timeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
          const response = await this.loadBalancingService.makeRequest(requestBody, timeout);
          return response;
      } catch (error) {
          // TODO: 에러처리는 @Filter 적용으로 변경 필요
          // 1. 클라이언트 에러
          if (error.response) {
              throw new HttpException(error.response.data, error.response.status);
          }
          
          // 2. 서비스에서 던진 커스텀 에러들
          if (error.message === 'No available Instances') {
              throw new HttpException(
                  'All AI instances are currently unavailable',
                  HttpStatus.SERVICE_UNAVAILABLE
              );
          }
          
          if (error.message === 'All retries failed') {
              throw new HttpException(
                  'Unable to process request after multiple attempts',
                  HttpStatus.BAD_GATEWAY
              );
          }
          
          // 3. 기타 예상치 못한 에러
          throw new HttpException(
              'Internal server error',
              HttpStatus.INTERNAL_SERVER_ERROR
          );
      }
  }
}
