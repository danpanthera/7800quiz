import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Length,
} from 'class-validator';

export enum ArenaHostModeDto {
  MANUAL = 'MANUAL',
  AUTO = 'AUTO',
}

export class CreateArenaDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsOptional()
  @IsEnum(ArenaHostModeDto)
  hostMode?: ArenaHostModeDto;

  // Mật khẩu phòng — tuỳ chọn, admin bật thêm nếu muốn chặn người ngoài quét QR/link vào tự do
  @IsOptional()
  @IsString()
  @Length(4, 20)
  passcode?: string;

  // @deprecated — dùng questionDurationSec. Giữ lại để không vỡ client cũ.
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  autoAdvanceSec?: number;

  // Thời gian trả lời mỗi câu (giây) — áp dụng cho CẢ MANUAL và AUTO, server
  // tự chốt deadline và tự khoá/công bố khi hết giờ.
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  questionDurationSec?: number;

  // Khoảng dừng xem kết quả trước khi tự sang câu kế — chỉ dùng ở chế độ AUTO
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(30)
  revealPauseSec?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  pointsForRank?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  penaltyWrong?: number;

  // Danh sách userId được mời — tuỳ chọn. Có >=1 phần tử thì phòng trở thành
  // allowlist: chỉ những userId này mới join được, người khác bị từ chối dù
  // có đúng mã/mật khẩu.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  invitedUserIds?: string[];

  // Tên các đội đặt trước — tuỳ chọn, tối đa 8 đội. Có >=1 tên thì lúc join
  // người chơi bắt buộc chọn 1 trong các đội này (không được tự gõ tên đội
  // mới), mỗi đội tối đa 5 người.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  presetTeamNames?: string[];
}
