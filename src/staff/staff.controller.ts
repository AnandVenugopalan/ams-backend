import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffService } from './staff.service';
import { VerifyAssetDto } from './dto/verify-asset.dto';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Post('verify')
  async verify(@Body() verifyAssetDto: VerifyAssetDto, @Request() req) {
    return this.staffService.verifyAsset(verifyAssetDto.assetId, req.user.userId);
  }
}