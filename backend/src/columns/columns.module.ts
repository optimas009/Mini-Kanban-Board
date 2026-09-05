import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BoardsModule } from '../boards/boards.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ColumnsController } from './columns.controller.js';
import { ColumnsService } from './columns.service.js';

@Module({
  imports: [PrismaModule, BoardsModule, AuthModule],
  controllers: [ColumnsController],
  providers: [ColumnsService],
  exports: [ColumnsService],
})
export class ColumnsModule {}
