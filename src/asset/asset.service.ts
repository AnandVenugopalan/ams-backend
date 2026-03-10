import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AssetService {
  constructor(private prisma: PrismaService) {}

  create(createAssetDto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        id: uuidv4(),
        ...createAssetDto,
        status: 'ACTIVE',
        isQrGenerated: false,
        updatedAt: new Date(),
      },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }

  async findAll(query: {
    search?: string;
    category?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, category, status, startDate, endDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    // Exclude deleted assets
    where.isDeleted = false;

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          category: true,
          serialNumber: true,
          status: true,
          location: true,
          imageUrl: true,
          lastVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          isQrGenerated: true,
        },
      }),
      this.prisma.asset.count({ where }),
    ]);

    // Fetch QR codes for all assets
    const assetIds = assets.map(a => a.id);
    const qrCodes = await this.prisma.qrCode.findMany({
      where: { assetId: { in: assetIds } },
      select: { assetId: true, code: true },
    });
    
    const qrCodeMap = new Map(qrCodes.map(qr => [qr.assetId, qr.code]));

    // Map assets to use qrCode as id
    const data = assets.map(asset => ({
      ...asset,
      id: qrCodeMap.get(asset.id) || asset.id, // Use QR code if available, otherwise asset ID
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportAssets(query: {
    search?: string;
    category?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { search, category, status, startDate, endDate } = query;

    const where: any = {};
    if (category) where.category = category.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    // Exclude deleted assets
    where.isDeleted = false;

    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch QR codes for each asset
    const data = await Promise.all(
      assets.map(async (asset) => {
        const qrCode = await this.prisma.qrCode.findFirst({
          where: { assetId: asset.id },
          select: { code: true },
        });

        return {
          id: asset.id,
          qrCode: qrCode?.code || 'Not Assigned',
          name: asset.name,
          category: asset.category,
          serialNumber: asset.serialNumber || '-',
          status: asset.status,
          location: asset.location,
          imageUrl: asset.imageUrl,
          lastVerifiedAt: asset.lastVerifiedAt,
          createdAt: asset.createdAt,
        };
      })
    );

    return {
      data,
      total: data.length,
      exportedAt: new Date().toISOString(),
    };
  }
}