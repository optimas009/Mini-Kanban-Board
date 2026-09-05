import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { COLUMN_COLORS } from './create-column.dto.js';

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(COLUMN_COLORS)
  color?: string;
}
