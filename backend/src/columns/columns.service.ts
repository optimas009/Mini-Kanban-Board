import { Injectable, NotFoundException } from '@nestjs/common';

import { BoardsService } from '../boards/boards.service.js';
import { withSerializableRetry } from '../common/serializable-retry.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateColumnDto } from './dto/create-column.dto.js';
import { MoveColumnDto } from './dto/move-column.dto.js';
import { UpdateColumnDto } from './dto/update-column.dto.js';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: BoardsService,
  ) {}

  async create(userId: string, boardId: string, dto: CreateColumnDto) {
    await this.boardsService.assertCanAccess(userId, boardId);

    return withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const position = await tx.column.count({
            where: { boardId },
          });

          return tx.column.create({
            data: {
              title: dto.title.trim(),
              color: dto.color ?? 'navy',
              position,
              boardId,
            },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      ),
    );
  }

  async update(userId: string, columnId: string, dto: UpdateColumnDto) {
    const column = await this.getColumn(columnId);

    await this.boardsService.assertCanAccess(userId, column.boardId);

    return this.prisma.column.update({
      where: { id: columnId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
  }

  async move(userId: string, columnId: string, dto: MoveColumnDto) {
    const column = await this.getColumn(columnId);

    await this.boardsService.assertCanAccess(userId, column.boardId);

    return withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const current = await tx.column.findUnique({
            where: { id: columnId },
          });

          if (!current) {
            throw new NotFoundException('Column not found');
          }

          const count = await tx.column.count({
            where: { boardId: current.boardId },
          });

          const newPosition = Math.min(dto.position, Math.max(0, count - 1));

          if (newPosition === current.position) {
            return current;
          }

          if (newPosition < current.position) {
            await tx.column.updateMany({
              where: {
                boardId: current.boardId,
                position: {
                  gte: newPosition,
                  lt: current.position,
                },
                NOT: {
                  id: current.id,
                },
              },
              data: {
                position: {
                  increment: 1,
                },
              },
            });
          } else {
            await tx.column.updateMany({
              where: {
                boardId: current.boardId,
                position: {
                  gt: current.position,
                  lte: newPosition,
                },
                NOT: {
                  id: current.id,
                },
              },
              data: {
                position: {
                  decrement: 1,
                },
              },
            });
          }

          return tx.column.update({
            where: { id: current.id },
            data: {
              position: newPosition,
            },
          });
        },
        {
          isolationLevel: 'Serializable',
        },
      ),
    );
  }

  async remove(userId: string, columnId: string) {
    const column = await this.getColumn(columnId);

    await this.boardsService.assertCanAccess(userId, column.boardId);

    await withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.column.delete({
            where: { id: columnId },
          });

          await tx.column.updateMany({
            where: {
              boardId: column.boardId,
              position: {
                gt: column.position,
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
      message: 'Column deleted successfully',
    };
  }

  private async getColumn(columnId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: {
        id: true,
        boardId: true,
        position: true,
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    return column;
  }
}
