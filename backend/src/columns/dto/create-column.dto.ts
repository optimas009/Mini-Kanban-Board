import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const COLUMN_COLORS = [
  'navy',
  'blue',
  'red',
  'yellow',
  'purple',
  'cyan',
  'green',
  'slate',
] as const;

export class CreateColumnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @IsIn(COLUMN_COLORS)
  color?: string;
}
