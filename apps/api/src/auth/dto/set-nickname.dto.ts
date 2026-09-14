import { IsString, MaxLength } from 'class-validator';

// Cho phép chuỗi rỗng (nghĩa là bỏ biệt danh, quay về hiện tên thật) — không
// dùng @IsOptional vì body vẫn bắt buộc phải có field này (rỗng khác thiếu).
export class SetNicknameDto {
  @IsString()
  @MaxLength(30, { message: 'Biệt danh tối đa 30 ký tự' })
  nickname: string;
}
