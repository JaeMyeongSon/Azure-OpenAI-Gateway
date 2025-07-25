import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import expressBasicAuth from 'express-basic-auth';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // decorator(@)가 없는 속성이 들어오면 해당 속성은 제거하고 받아들입니다.
      forbidNonWhitelisted: true, // DTO에 정의되지 않은 값이 넘어오면 request 자체를 막습니다.
      transform: true,
    }),
  );

  app.use(cookieParser());

  app.use(
    ['/docs', '/docs-json'],
    expressBasicAuth({
      challenge: true,
      users: {
        [configService.get<string>('SWAGGER_ID')]:
          configService.get<string>('SWAGGER_PW'),
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('OpenAI Loadbalancer API')
    .setDescription('API documentation for OpenAI Loadbalancer')
    .setVersion('1.0.1')
    .addCookieAuth('connect.sid')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(configService.get<number>('PORT') ?? 3000);
}
bootstrap();
