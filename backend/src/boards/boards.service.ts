import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { ShareBoardDto } from './dto/share-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBoardDto) {
    return this.prisma.board.create({
      data: {
        name: dto.name.trim(),
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.board.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            columns: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(userId: string, boardId: string) {
    await this.assertCanAccess(userId, boardId);

    return this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        columns: {
          select: {
            id: true,
            title: true,
            color: true,
            position: true,
            createdAt: true,
            updatedAt: true,
            tasks: {
              select: {
                id: true,
                title: true,
                description: true,
                position: true,
                columnId: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: {
                position: 'asc',
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
  }

  async update(userId: string, boardId: string, dto: UpdateBoardDto) {
    await this.assertOwner(userId, boardId);

    return this.prisma.board.update({
      where: { id: boardId },
      data: {
        name: dto.name.trim(),
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(userId: string, boardId: string) {
    await this.assertOwner(userId, boardId);

    await this.prisma.board.delete({
      where: { id: boardId },
    });

    return {
      message: 'Board deleted successfully',
    };
  }

  async share(userId: string, boardId: string, dto: ShareBoardDto) {
    const board = await this.assertOwner(userId, boardId);
    const email = dto.email.trim().toLowerCase();

    const userToAdd = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!userToAdd) {
      throw new NotFoundException('No registered user found with this email');
    }

    if (userToAdd.id === board.ownerId) {
      throw new BadRequestException('The board owner already has access');
    }

    const existingMembership = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: userToAdd.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('This user already has access to the board');
    }

    await this.prisma.boardMember.create({
      data: {
        boardId,
        userId: userToAdd.id,
      },
    });

    return {
      message: 'Board shared successfully',
      member: userToAdd,
    };
  }

  async removeMember(
    ownerUserId: string,
    boardId: string,
    memberUserId: string,
  ) {
    await this.assertOwner(ownerUserId, boardId);

    const membership = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: memberUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Board member not found');
    }

    await this.prisma.boardMember.delete({
      where: {
        boardId_userId: {
          boardId,
          userId: memberUserId,
        },
      },
    });

    return {
      message: 'Board member removed successfully',
    };
  }

  async assertCanAccess(userId: string, boardId: string) {
    const board = await this.prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    return board;
  }

  async assertOwner(userId: string, boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.ownerId !== userId) {
      throw new ForbiddenException('Only the board owner can do this');
    }

    return board;
  }
}
