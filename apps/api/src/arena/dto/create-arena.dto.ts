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

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  autoAdvanceSec?: number;

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
}
