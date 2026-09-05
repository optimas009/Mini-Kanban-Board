import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { ColumnsService } from './columns.service.js';
import { CreateColumnDto } from './dto/create-column.dto.js';
import { MoveColumnDto } from './dto/move-column.dto.js';
import { UpdateColumnDto } from './dto/update-column.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post('boards/:boardId/columns')
  create(
    @CurrentUser() user: AuthUser,
    @Param('boardId') boardId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columnsService.create(user.userId, boardId, dto);
  }

  @Patch('columns/:columnId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('columnId') columnId: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.columnsService.update(user.userId, columnId, dto);
  }

  @Patch('columns/:columnId/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('columnId') columnId: string,
    @Body() dto: MoveColumnDto,
  ) {
    return this.columnsService.move(user.userId, columnId, dto);
  }

  @Delete('columns/:columnId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('columnId') columnId: string,
  ) {
    return this.columnsService.remove(user.userId, columnId);
  }
}
