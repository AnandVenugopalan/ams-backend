import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReportIssueDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
