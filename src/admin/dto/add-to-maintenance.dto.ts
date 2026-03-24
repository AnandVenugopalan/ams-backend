import { IsString, IsNotEmpty } from 'class-validator';

export class AddToMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;
}
