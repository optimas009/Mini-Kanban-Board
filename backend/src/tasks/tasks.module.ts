import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BoardsModule } from '../boards/boards.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [
    PrismaModule,
    BoardsModule,
    AuthModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}