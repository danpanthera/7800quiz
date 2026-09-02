import { IsArray, IsString, IsUUID } from 'class-validator';

export class SyncPushDto {
  @IsArray()
  submissionIds: string[]; // IDs của các submission cần đồng bộ
}
