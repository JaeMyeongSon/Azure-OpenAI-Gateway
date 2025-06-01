import { Module } from '@nestjs/common';
import { LoadbalanceModule } from './loadbalance/loadbalance.module';

@Module({
  imports: [LoadbalanceModule],
})
export class ApiModule {}
