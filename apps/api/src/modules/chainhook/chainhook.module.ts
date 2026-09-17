import { Module } from '@nestjs/common';
import { ChainhookController } from './chainhook.controller';

@Module({ controllers: [ChainhookController] })
export class ChainhookModule {}
