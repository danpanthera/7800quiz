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
}
