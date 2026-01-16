import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}