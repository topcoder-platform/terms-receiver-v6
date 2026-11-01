import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { Database } from './database.js';
import { Integrations } from './integrations.js';
import { ReceiverService } from './receiver.service.js';
import { ReceiverController } from './receiver.controller.js';
import { ErrorFilter } from './errors.js';
@Controller()
class HealthController {
  @Get('health') health() { return { checksRun: 1 }; }
}
@Module({ controllers: [ReceiverController, HealthController], providers: [Database, Integrations, ReceiverService] })
export class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(raw({ type: '*/xml', limit: '100kb' }));
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalFilters(new ErrorFilter(true));
  await app.init();
  return app;
}
