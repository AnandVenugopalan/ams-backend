import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterAssetDto } from './dto/register-asset.dto';
import { ReportIssueDto } from './dto/report-issue.dto';

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

  async verifyStaffAsset(assetId: string, verifiedBy: string) {
    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const currentTime = new Date();

    // Update asset lastVerifiedAt
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        lastVerifiedAt: currentTime,
      },
    });

    // Insert record into verification log
    await this.prisma.verificationLog.create({
      data: {
        assetId,
        verifiedBy,
        verifiedAt: currentTime,
      },
    });

    return {
      message: 'Asset verified successfully',
      assetId,
      verifiedAt: currentTime,
    };
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

  async reportIssue(reportIssueDto: ReportIssueDto, staffId: string) {
    const { assetId, description, imageUrl } = reportIssueDto;

    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Create complaint record
    await this.prisma.complaint.create({
      data: {
        assetId,
        reportedBy: staffId,
        description,
        imageUrl: imageUrl || null,
        status: 'PENDING',
      },
    });

    return { message: 'Issue reported successfully' };
  }

  async getVerificationHistory(staffId: string) {
    const verificationLogs = await this.prisma.verificationLog.findMany({
      where: {
        verifiedBy: staffId,
      },
      orderBy: {
        verifiedAt: 'desc',
      },
    });

    // Fetch asset details for each verification
    const history = await Promise.all(
      verificationLogs.map(async (log) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: log.assetId },
          select: {
            id: true,
            name: true,
          },
        });

        return {
          id: log.id,
          assetId: log.assetId,
          assetName: asset?.name || 'Unknown Asset',
          verifiedAt: log.verifiedAt,
        };
      })
    );

    return history;
  }

  async getComplaintHistory(staffId: string) {
    const complaints = await this.prisma.complaint.findMany({
      where: {
        reportedBy: staffId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch asset details for each complaint
    const history = await Promise.all(
      complaints.map(async (complaint) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: complaint.assetId },
          select: {
            name: true,
          },
        });

        return {
          id: complaint.id,
          assetId: complaint.assetId,
          assetName: asset?.name || 'Unknown Asset',
          description: complaint.description,
          status: complaint.status,
          createdAt: complaint.createdAt,
        };
      })
    );

    return history;
  }

  async getAllAssets() {
    const assets = await this.prisma.asset.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        location: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return assets;
  }
}