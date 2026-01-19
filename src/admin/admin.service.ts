import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const totalAssets = await this.prisma.asset.count();
    const activeAssets = await this.prisma.asset.count({
      where: { status: 'ACTIVE' },
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
}