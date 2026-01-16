import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyAssetDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;
}