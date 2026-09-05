import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BoardsService } from '../boards/boards.service.js';
import { withSerializableRetry } from '../common/serializable-retry.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  async create(userId: string, columnId: string, dto: CreateTaskDto) {
    const column = await this.getColumn(columnId);

    await this.boardsService.assertCanAccess(userId, column.boardId);

    return withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const position = await tx.task.count({
            where: { columnId },
          });

          return tx.task.create({
            data: {
              title: dto.title.trim(),
              description: this.normalizeDescription(dto.description),
              position,
              columnId,
            },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      ),
    );
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.getTask(taskId);

    await this.boardsService.assertCanAccess(userId, task.column.boardId);

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: this.normalizeDescription(dto.description) }
          : {}),
      },
    });
  }

  async move(userId: string, taskId: string, dto: MoveTaskDto) {
    const task = await this.getTask(taskId);

    await this.boardsService.assertCanAccess(userId, task.column.boardId);

    return withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const currentTask = await tx.task.findUnique({
            where: { id: taskId },
            include: {
              column: {
                select: {
                  id: true,
                  boardId: true,
                },
              },
            },
          });

          if (!currentTask) {
            throw new NotFoundException('Task not found');
          }

          const targetColumn = await tx.column.findUnique({
            where: { id: dto.columnId },
            select: {
              id: true,
              boardId: true,
            },
          });

          if (!targetColumn) {
            throw new NotFoundException('Target column not found');
          }

          if (targetColumn.boardId !== currentTask.column.boardId) {
            throw new BadRequestException(
              'Tasks cannot be moved to a different board',
            );
          }

          if (currentTask.columnId === targetColumn.id) {
            const count = await tx.task.count({
              where: { columnId: currentTask.columnId },
            });

            const newPosition = Math.min(
              dto.position,
              Math.max(0, count - 1),
            );

            if (newPosition === currentTask.position) {
              return currentTask;
            }

            if (newPosition < currentTask.position) {
              await tx.task.updateMany({
                where: {
                  columnId: currentTask.columnId,
                  position: {
                    gte: newPosition,
                    lt: currentTask.position,
                  },
                  NOT: {
                    id: currentTask.id,
                  },
                },
                data: {
                  position: {
                    increment: 1,
                  },
                },
              });
            } else {
              await tx.task.updateMany({
                where: {
                  columnId: currentTask.columnId,
                  position: {
                    gt: currentTask.position,
                    lte: newPosition,
                  },
                  NOT: {
                    id: currentTask.id,
                  },
                },
                data: {
                  position: {
                    decrement: 1,
                  },
                },
              });
            }

            return tx.task.update({
              where: { id: currentTask.id },
              data: {
                position: newPosition,
              },
            });
          }

          const targetCount = await tx.task.count({
            where: {
              columnId: targetColumn.id,
            },
          });

          const targetPosition = Math.min(dto.position, targetCount);

          await tx.task.updateMany({
            where: {
              columnId: currentTask.columnId,
              position: {
                gt: currentTask.position,
              },
            },
            data: {
              position: {
                decrement: 1,
              },
            },
          });

          await tx.task.updateMany({
            where: {
              columnId: targetColumn.id,
              position: {
                gte: targetPosition,
              },
            },
            data: {
              position: {
                increment: 1,
              },
            },
          });

          return tx.task.update({
            where: { id: currentTask.id },
            data: {
              columnId: targetColumn.id,
              position: targetPosition,
            },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      ),
    );
  }

  async remove(userId: string, taskId: string) {
    const task = await this.getTask(taskId);

    await this.boardsService.assertCanAccess(userId, task.column.boardId);

    await withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.task.delete({
            where: { id: taskId },
          });

          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              position: {
                gt: task.position,
              },
            },
            data: {
              position: {
                decrement: 1,
              },
            },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      ),
    );

    return {
      message: 'Task deleted successfully',
    };
  }

  private async getColumn(columnId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    return column;
  }

  private async getTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        column: {
          select: {
            id: true,
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private normalizeDescription(description?: string) {
    if (description === undefined) {
      return undefined;
    }

    const normalized = description.trim();

    return normalized.length > 0 ? normalized : null;
  }
}
