import { IsString, Length } from 'class-validator';

export class SetAvatarEmojiDto {
  @IsString()
  @Length(1, 16)
  emoji: string;
}
