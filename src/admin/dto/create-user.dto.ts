import { IsString, IsEmail, IsBoolean, IsEnum, IsOptional, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsBoolean()
  isActive: boolean;
}
