import { IsString, IsNotEmpty } from 'class-validator';

export class ResolveComplaintDto {
  @IsString()
  @IsNotEmpty()
  resolution: string;
}
