import { Module } from '@nestjs/common';
import { LoadbalanceController } from './loadbalance.controller';
import { LoadbalanceService } from './service/loadbalance.service';

@Module({
  controllers: [LoadbalanceController],
  providers: [LoadbalanceService],
})
export class LoadbalanceModule {}
