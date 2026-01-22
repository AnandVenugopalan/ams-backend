import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) { }

  async getDashboard() {
    const totalAssets = await this.prisma.asset.count({
      where: { isDeleted: false },
    });
    const activeAssets = await this.prisma.asset.count({
      where: { status: 'ACTIVE', isDeleted: false },
    });

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const verifiedToday = await this.prisma.verificationLog.count({
      where: {
        verifiedAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const complaintsCount = await this.prisma.complaint.count();

    // Charts data
    const assetsByCategory = await this.prisma.asset.groupBy({
      by: ['category'],
      _count: { category: true },
    });

    const assetsByStatus = await this.prisma.asset.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const verificationTrend = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const count = await this.prisma.verificationLog.count({
        where: { verifiedAt: { gte: startOfDay, lt: endOfDay } },
      });
      verificationTrend.unshift({
        date: startOfDay.toISOString().split('T')[0],
        count,
      });
    }

    // Recent data
    const recentAssets = await this.prisma.asset.findMany({
      where: { isDeleted: false },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });

    const recentVerified = await this.prisma.verificationLog.findMany({
      take: 5,
      orderBy: { verifiedAt: 'desc' },
      select: {
        assetId: true,
        verifiedBy: true,
        verifiedAt: true,
      },
    });

    return {
      totalAssets,
      activeAssets,
      verifiedToday,
      complaintsCount,
      charts: {
        assetsByCategory: assetsByCategory.map(item => ({
          category: item.category,
          count: item._count.category,
        })),
        assetsByStatus: assetsByStatus.map(item => ({
          status: item.status,
          count: item._count.status,
        })),
        verificationTrend,
      },
      recent: {
        recentAssets,
        recentVerified,
      },
    };
  }

  async getVerifications() {
    const logs = await this.prisma.verificationLog.findMany({
      orderBy: { verifiedAt: 'desc' },
    });

    const data = await Promise.all(
      logs.map(async (log) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: log.assetId },
          select: { name: true },
        });

        const user = await this.prisma.user.findFirst({
          where: { username: log.verifiedBy },
          select: { username: true },
        });

        return {
          assetId: log.assetId,
          assetName: asset?.name || 'Unknown',
          verifiedBy: user?.username || log.verifiedBy,
          createdAt: log.verifiedAt,
        };
      })
    );

    return {
      data,
      total: data.length,
    };
  }

  async getComplaints() {
    const complaints = await this.prisma.complaint.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const data = await Promise.all(
      complaints.map(async (complaint) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: complaint.assetId },
          select: { name: true },
        });

        const user = await this.prisma.user.findFirst({
          where: { username: complaint.reportedBy },
          select: { username: true },
        });

        return {
          id: complaint.id,
          assetId: complaint.assetId,
          assetName: asset?.name || 'Unknown',
          description: '',
          status: complaint.status,
          reportedBy: user?.username || complaint.reportedBy,
          createdAt: complaint.createdAt,
        };
      })
    );

    return {
      data,
      total: data.length,
    };
  }

  async resolveComplaint(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return this.prisma.complaint.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        designation: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    // Check for duplicate username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Check for duplicate email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        fullName: createUserDto.fullName,
        email: createUserDto.email,
        username: createUserDto.username,
        password: hashedPassword,
        role: createUserDto.role,
        designation: createUserDto.designation,
        phone: createUserDto.phone,
        isActive: createUserDto.isActive,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        designation: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  async updateUserStatus(id: string, updateUserStatusDto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: updateUserStatusDto.isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        designation: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async generateQrCodes(generateQrDto: GenerateQrDto) {
    try {
      const { count } = generateQrDto;

      // Additional validation in service layer
      if (!count || typeof count !== 'number' || count < 1 || count > 100) {
        throw new BadRequestException('Count must be a number between 1 and 100');
      }

      const qrCodes = [];
      const generatedCodes = new Set<string>();

      // Generate unique codes
      while (qrCodes.length < count) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const code = `QR-${randomNum}`;

        // Skip if already generated in this batch
        if (generatedCodes.has(code)) {
          continue;
        }

        generatedCodes.add(code);
        qrCodes.push({
          code,
          isAssigned: false,
        });
      }

      // Check for existing codes in database
      const existingCodes = await this.prisma.qrCode.findMany({
        where: {
          code: {
            in: Array.from(generatedCodes),
          },
        },
        select: { code: true },
      });

      // If any codes already exist, regenerate those
      if (existingCodes.length > 0) {
        const existingCodeSet = new Set(existingCodes.map((qr) => qr.code));
        const finalCodes = qrCodes.filter((qr) => !existingCodeSet.has(qr.code));
        const needMore = count - finalCodes.length;

        // Regenerate the conflicting ones
        for (let i = 0; i < needMore; i++) {
          let attempts = 0;
          let newCode: string;

          do {
            const randomNum = Math.floor(100000 + Math.random() * 900000);
            newCode = `QR-${randomNum}`;
            attempts++;

            if (attempts > 1000) {
              throw new BadRequestException('Unable to generate unique QR codes');
            }
          } while (
            generatedCodes.has(newCode) ||
            existingCodeSet.has(newCode)
          );

          generatedCodes.add(newCode);
          finalCodes.push({
            code: newCode,
            isAssigned: false,
          });
        }

        // Replace with final codes
        qrCodes.length = 0;
        qrCodes.push(...finalCodes);
      }

      // Bulk insert with skipDuplicates to handle race conditions
      await this.prisma.qrCode.createMany({
        data: qrCodes,
        skipDuplicates: true,
      });

      // Fetch and return created QR codes
      const result = await this.prisma.qrCode.findMany({
        where: {
          code: {
            in: qrCodes.map((qr) => qr.code),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        count: result.length,
        qrCodes: result,
      };
    } catch (error) {
      console.error('Error generating QR codes:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to generate QR codes: ${error.message || 'Unknown error'}`);
    }
  }

  async getAssetDetails(assetId: string) {
    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Fetch QR code for this asset
    const qrCode = await this.prisma.qrCode.findFirst({
      where: { assetId: assetId },
    });

    // Fetch creator/registered by user info
    let createdByUser = null;
    if (asset.registeredBy) {
      const user = await this.prisma.user.findUnique({
        where: { id: asset.registeredBy },
        select: {
          id: true,
          fullName: true,
          email: true,
          designation: true,
        },
      });
      createdByUser = user;
    }

    return {
      id: asset.id,
      assetName: asset.name,
      category: asset.category,
      serialNumber: asset.serialNumber,
      status: asset.status,
      location: asset.location,
      imageUrl: null, // Asset model doesn't have imageUrl field
      qrCode: qrCode?.code || null,
      createdAt: asset.createdAt,
      lastVerifiedAt: asset.lastVerifiedAt,
      createdBy: createdByUser,
    };
  }

  async getAssetVerificationHistory(assetId: string) {
    const verificationLogs = await this.prisma.verificationLog.findMany({
      where: {
        assetId: assetId,
      },
      orderBy: {
        verifiedAt: 'desc',
      },
    });

    // Fetch staff names for each verification
    const history = await Promise.all(
      verificationLogs.map(async (log) => {
        const user = await this.prisma.user.findUnique({
          where: { id: log.verifiedBy },
          select: {
            fullName: true,
          },
        });

        return {
          id: log.id,
          verifiedBy: user?.fullName || 'Unknown User',
          verifiedAt: log.verifiedAt,
        };
      })
    );

    return history;
  }

  async getAssetComplaints(assetId: string) {
    const complaints = await this.prisma.complaint.findMany({
      where: {
        assetId: assetId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch staff names for each complaint
    const complaintHistory = await Promise.all(
      complaints.map(async (complaint) => {
        const user = await this.prisma.user.findUnique({
          where: { id: complaint.reportedBy },
          select: {
            fullName: true,
          },
        });

        return {
          id: complaint.id,
          description: complaint.description,
          imageUrl: complaint.imageUrl,
          status: complaint.status,
          createdAt: complaint.createdAt,
          reportedBy: user?.fullName || 'Unknown User',
        };
      })
    );

    return complaintHistory;
  }

  async updateAsset(assetId: string, updateData: any) {
    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Update asset fields
    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        name: updateData.name,
        category: updateData.category,
        serialNumber: updateData.serialNumber,
        status: updateData.status,
      },
    });

    return updatedAsset;
  }

  async deleteAsset(assetId: string) {
    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Soft delete the asset
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        isDeleted: true,
      },
    });

    // Unassign the QR code if assigned
    await this.prisma.qrCode.updateMany({
      where: { assetId: assetId },
      data: {
        isAssigned: false,
        assetId: null,
      },
    });

    return { message: 'Asset deleted successfully' };
  }

  async regenerateQrCode(assetId: string) {
    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Find old QR code assigned to this asset
    const oldQr = await this.prisma.qrCode.findFirst({
      where: { assetId: assetId },
    });

    // Invalidate old QR code
    if (oldQr) {
      await this.prisma.qrCode.update({
        where: { id: oldQr.id },
        data: {
          isAssigned: false,
          assetId: null,
        },
      });
    }

    // Generate new unique QR code
    let newCode: string;
    let attempts = 0;
    do {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      newCode = `QR-${randomNum}`;
      attempts++;

      if (attempts > 1000) {
        throw new BadRequestException('Unable to generate unique QR code');
      }

      const exists = await this.prisma.qrCode.findUnique({
        where: { code: newCode },
      });

      if (!exists) break;
    } while (true);

    // Create new QR code and assign to asset
    const newQr = await this.prisma.qrCode.create({
      data: {
        code: newCode,
        isAssigned: true,
        assetId: assetId,
      },
    });

    return {
      message: 'QR code regenerated successfully',
      qrCode: newQr.code,
    };
  }
}