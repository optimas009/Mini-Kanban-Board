import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
