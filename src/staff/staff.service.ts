import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterAssetDto } from './dto/register-asset.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async verifyAsset(assetId: string, verifiedBy: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    await this.prisma.verificationLog.create({
      data: {
        assetId,
        verifiedBy,
      },
    });

    return { message: 'Asset verified successfully' };
  }

  async registerAsset(registerAssetDto: RegisterAssetDto, staffId: string) {
    const { qrCode, assetName, category, serialNumber, location } = registerAssetDto;

    // Find QR code
    const qr = await this.prisma.qrCode.findUnique({
      where: { code: qrCode },
    });

    if (!qr) {
      throw new NotFoundException('QR code not found');
    }

    if (qr.isAssigned) {
      throw new BadRequestException('QR code is already assigned to an asset');
    }

    // Create asset
    const asset = await this.prisma.asset.create({
      data: {
        name: assetName,
        category,
        serialNumber,
        location: location || 'Not specified',
        isQrGenerated: true,
        registeredBy: staffId,
      },
    });

    // Update QR code
    await this.prisma.qrCode.update({
      where: { id: qr.id },
      data: {
        isAssigned: true,
        assetId: asset.id,
        registeredBy: staffId,
      },
    });

    return asset;
  }

  async verifyQr(code: string) {
    const qr = await this.prisma.qrCode.findUnique({
      where: { code },
    });

    if (!qr) {
      return {
        valid: false,
        message: 'Invalid QR code',
      };
    }

    if (qr.isAssigned && qr.assetId) {
      // Fetch asset details
      const asset = await this.prisma.asset.findUnique({
        where: { id: qr.assetId },
      });

      return {
        valid: true,
        alreadyAssigned: true,
        asset: asset ? {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          serialNumber: asset.serialNumber,
          status: asset.status,
          location: asset.location,
        } : null,
      };
    }

    return {
      valid: true,
      alreadyAssigned: false,
      qrId: qr.id,
      qrCode: qr.code,
    };
  }
}