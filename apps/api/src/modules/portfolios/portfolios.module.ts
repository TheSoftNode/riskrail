import { Module } from '@nestjs/common';
import { PortfoliosController } from './portfolios.controller.js';
import { PortfoliosService } from './portfolios.service.js';
@Module({ controllers: [PortfoliosController], providers: [PortfoliosService] })
export class PortfoliosModule {}
