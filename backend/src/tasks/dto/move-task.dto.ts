import { IsInt, IsString, Min } from 'class-validator';

export class MoveTaskDto {
  @IsString()
  columnId!: string;

  @IsInt()
  @Min(0)
  position!: number;
}
