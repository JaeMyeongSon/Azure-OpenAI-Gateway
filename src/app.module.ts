import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoadBalancingModule } from './load-balancing/load-balancing.module';

@Module({
  imports: [LoadBalancingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
