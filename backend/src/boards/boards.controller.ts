import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { BoardsService } from './boards.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { ShareBoardDto } from './dto/share-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.boardsService.findAllForUser(user.userId);
  }

  @Get(':boardId')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
  ) {
    return this.boardsService.findOne(user.userId, boardId);
  }

  @Patch(':boardId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardsService.update(user.userId, boardId, dto);
  }

  @Delete(':boardId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
  ) {
    return this.boardsService.remove(user.userId, boardId);
  }

  @Post(':boardId/members')
  share(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Body() dto: ShareBoardDto,
  ) {
    return this.boardsService.share(user.userId, boardId, dto);
  }

  @Delete(':boardId/members/:memberUserId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.boardsService.removeMember(
      user.userId,
      boardId,
      memberUserId,
    );
  }
}
