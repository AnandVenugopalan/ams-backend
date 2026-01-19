import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffService } from './staff.service';
import { VerifyAssetDto } from './dto/verify-asset.dto';
import { RegisterAssetDto } from './dto/register-asset.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Post('verify')
  async verify(@Body() verifyAssetDto: VerifyAssetDto, @Request() req) {
    return this.staffService.verifyAsset(verifyAssetDto.assetId, req.user.userId);
  }

  @Post('assets/register')
  async registerAsset(@Body() registerAssetDto: RegisterAssetDto, @Request() req) {
    return this.staffService.registerAsset(registerAssetDto, req.user.userId);
  }

  @Post('qr/verify')
  async verifyQr(@Body() verifyQrDto: VerifyQrDto) {
    return this.staffService.verifyQr(verifyQrDto.qrCode);
  }
}