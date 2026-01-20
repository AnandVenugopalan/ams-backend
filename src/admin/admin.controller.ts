import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('verifications')
  getVerifications() {
    return this.adminService.getVerifications();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('complaints')
  getComplaints() {
    return this.adminService.getComplaints();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('complaints/:id/resolve')
  resolveComplaint(@Param('id') id: string) {
    return this.adminService.resolveComplaint(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('users')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, updateUserStatusDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('qr/generate')
  generateQrCodes(@Body() generateQrDto: GenerateQrDto) {
    return this.adminService.generateQrCodes(generateQrDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets/:assetId')
  getAssetDetails(@Param('assetId') assetId: string) {
    return this.adminService.getAssetDetails(assetId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets/:assetId/verifications')
  getAssetVerificationHistory(@Param('assetId') assetId: string) {
    return this.adminService.getAssetVerificationHistory(assetId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets/:assetId/complaints')
  getAssetComplaints(@Param('assetId') assetId: string) {
    return this.adminService.getAssetComplaints(assetId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('assets/:assetId')
  updateAsset(
    @Param('assetId') assetId: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    return this.adminService.updateAsset(assetId, updateAssetDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('assets/:assetId')
  deleteAsset(@Param('assetId') assetId: string) {
    return this.adminService.deleteAsset(assetId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('assets/:assetId/regenerate-qr')
  regenerateQrCode(@Param('assetId') assetId: string) {
    return this.adminService.regenerateQrCode(assetId);
  }
}