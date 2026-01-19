import { IsString, IsEnum, IsOptional } from 'class-validator';
import { AssetCategory } from '@prisma/client';

export class RegisterAssetDto {
  @IsString()
  qrCode: string;

  @IsString()
  assetName: string;

  @IsEnum(AssetCategory)
  category: AssetCategory;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
