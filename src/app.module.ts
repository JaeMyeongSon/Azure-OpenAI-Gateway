import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoadBalancingModule } from './load-balancing/load-balancing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
    }),
    LoadBalancingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
