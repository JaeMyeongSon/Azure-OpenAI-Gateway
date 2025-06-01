import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiModule } from './api/api.module';
import { HttpExceptionFilter } from './common/filter/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
    }),
    ApiModule,
  ],
  // TODO - Prisma Database init
  providers: [{ provide: 'APP_FILTER', useClass: HttpExceptionFilter }],
})
export class AppModule {}
