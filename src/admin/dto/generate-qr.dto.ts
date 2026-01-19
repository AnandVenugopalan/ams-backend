import { IsInt, Min, Max } from 'class-validator';

export class GenerateQrDto {
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;
}
