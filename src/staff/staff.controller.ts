import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffService } from './staff.service';
import { VerifyAssetDto } from './dto/verify-asset.dto';
import { RegisterAssetDto } from './dto/register-asset.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { ReportIssueDto } from './dto/report-issue.dto';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Post('verify')
  async verify(@Body() verifyAssetDto: VerifyAssetDto, @Request() req) {
    return this.staffService.verifyAsset(verifyAssetDto.assetId, req.user.userId);
  }

  @Post('assets/verify')
  async verifyStaffAsset(@Body() verifyAssetDto: VerifyAssetDto, @Request() req) {
    return this.staffService.verifyStaffAsset(verifyAssetDto.assetId, req.user.userId);
  }

  @Post('assets/register')
  async registerAsset(@Body() registerAssetDto: RegisterAssetDto, @Request() req) {
    return this.staffService.registerAsset(registerAssetDto, req.user.userId);
  }

  @Post('qr/verify')
  async verifyQr(@Body() verifyQrDto: VerifyQrDto) {
    return this.staffService.verifyQr(verifyQrDto.qrCode);
  }

  @Post('complaints')
  async reportIssue(@Body() reportIssueDto: ReportIssueDto, @Request() req) {
    return this.staffService.reportIssue(reportIssueDto, req.user.userId);
  }

  @Get('history/verified')
  async getVerificationHistory(@Request() req) {
    return this.staffService.getVerificationHistory(req.user.userId);
  }

  @Get('history/complaints')
  async getComplaintHistory(@Request() req) {
    return this.staffService.getComplaintHistory(req.user.userId);
  }

  @Get('assets')
  async getAllAssets() {
    return this.staffService.getAllAssets();
  }
}