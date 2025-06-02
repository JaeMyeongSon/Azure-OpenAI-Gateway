import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { LoadBalancingService } from './load-balancing.service';

@Controller('load-balancing')
export class LoadBalancingController {
  constructor(private readonly loadBalancingService: LoadBalancingService) {}

  @Post('/openai/deployments/:deploymentName/chat/:method')
  @HttpCode(HttpStatus.OK)
  async sendAzureOpenAI(
    @Param('deploymentName') deploymentName: string,
    @Param('method') method: string,
    @Query('api-version') apiVersion: string,
    @Body() data: any,
  ) {
    return this.loadBalancingService.sendAzureOpenAIGetChatCompletions(
      deploymentName,
      method,
      apiVersion,
      data,
    );
  }
}
