import { Module } from '@nestjs/common';
import { LoadBalancingController } from './load-balancing.controller';
import { LoadBalancingService } from './load-balancing.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { InstanceConfigService } from './instance-config.service';

@Module({
  controllers: [LoadBalancingController],
  providers: [
    LoadBalancingService,
    CircuitBreakerService,
    InstanceConfigService
  ],
  exports: [LoadBalancingService]
})
export class LoadBalancingModule {}
