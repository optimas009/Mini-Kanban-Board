import { IsEmail, MaxLength } from 'class-validator';

export class ShareBoardDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
