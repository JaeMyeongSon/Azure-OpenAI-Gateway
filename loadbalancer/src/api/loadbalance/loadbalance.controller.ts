import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoadbalanceService } from './service/loadbalance.service';

@ApiTags('LoadBalancer')
@Controller('lb')
export class LoadbalanceController {
  constructor(private readonly loadbalanceService: LoadbalanceService) {}

  @Get('/')
  @ApiOperation({
    summary: 'Get the status of the load balancer node',
    description: 'Returns the status of the current load balancer node.',
  })
  async getNodeStatus(): Promise<string> {
    return await this.loadbalanceService.getNodeStatus();
  }
}
