import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';
import { AddToMaintenanceDto } from './dto/add-to-maintenance.dto';

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
  @Get('verifications/export/data')
  exportVerifications(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('verifiedBy') verifiedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.exportVerifications({
      search,
      category,
      status,
      verifiedBy,
      startDate,
      endDate,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('verifications')
  getVerifications(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('verifiedBy') verifiedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getVerifications({
      search,
      category,
      status,
      verifiedBy,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('complaints/export/data')
  exportComplaints(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('reportedBy') reportedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.exportComplaints({
      search,
      status,
      reportedBy,
      startDate,
      endDate,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('complaints')
  getComplaints(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('reportedBy') reportedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getComplaints({
      search,
      status,
      category,
      reportedBy,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('complaints/:id/resolve')
  resolveComplaint(
    @Param('id') id: string,
    @Body() resolveComplaintDto: ResolveComplaintDto,
  ) {
    return this.adminService.resolveComplaint(id, resolveComplaintDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('complaints/:complaintId')
  getComplaintById(@Param('complaintId') complaintId: string) {
    return this.adminService.getComplaintById(complaintId);
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
  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('users/avatars/set-defaults')
  setDefaultAvatars() {
    return this.adminService.setDefaultAvatarsForUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('qr/generate')
  generateQrCodes(@Body() generateQrDto: GenerateQrDto) {
    return this.adminService.generateQrCodes(generateQrDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets')
  getAssets(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAssets({
      search,
      category,
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets/:qrCode')
  getAssetDetails(@Param('qrCode') qrCode: string) {
    return this.adminService.getAssetDetails(qrCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets/:qrCode/verifications')
  getAssetVerificationHistory(@Param('qrCode') qrCode: string) {
    return this.adminService.getAssetVerificationHistory(qrCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('assets/:qrCode/complaints')
  getAssetComplaints(@Param('qrCode') qrCode: string) {
    return this.adminService.getAssetComplaints(qrCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('assets/:qrCode')
  updateAsset(
    @Param('qrCode') qrCode: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    return this.adminService.updateAsset(qrCode, updateAssetDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('assets/:qrCode')
  deleteAsset(@Param('qrCode') qrCode: string) {
    return this.adminService.deleteAsset(qrCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('assets/:assetId/maintenance')
  addToMaintenance(@Param('assetId') assetId: string) {
    return this.adminService.addToMaintenance(assetId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('assets/:qrCode/regenerate-qr')
  regenerateQrCode(@Param('qrCode') qrCode: string) {
    return this.adminService.regenerateQrCode(qrCode);
  }
}