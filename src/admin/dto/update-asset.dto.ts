import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class UpdateAssetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['LAPTOP', 'CAMERA', 'MOBILE', 'TABLET', 'OTHER'], {
    message: 'category must be one of: LAPTOP, CAMERA, MOBILE, TABLET, OTHER',
  })
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsEnum(['ACTIVE', 'MAINTENANCE', 'RETIRED', 'LOST'], {
    message: 'status must be one of: ACTIVE, MAINTENANCE, RETIRED, LOST',
  })
  @IsNotEmpty()
  status: string;
}
