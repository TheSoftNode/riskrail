import { Module } from '@nestjs/common';
import { ChainhookController } from './chainhook.controller.js';
import { ChainhookService } from './chainhook.service.js';

@Module({ controllers: [ChainhookController], providers: [ChainhookService] })
export class ChainhookModule {}
