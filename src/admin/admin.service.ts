import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

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

    const recentVerifiedLogs = await this.prisma.verificationLog.findMany({
      take: 5,
      orderBy: { verifiedAt: 'desc' },
      select: {
        assetId: true,
        verifiedBy: true,
        verifiedAt: true,
      },
    });

    const recentVerified = await Promise.all(
      recentVerifiedLogs.map(async (log) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: log.assetId },
          select: { name: true },
        });

        const user = await this.prisma.user.findUnique({
          where: { id: log.verifiedBy },
          select: { fullName: true },
        });

        return {
          assetId: log.assetId,
          assetName: asset?.name || 'Unknown',
          verifiedBy: user?.fullName || 'Unknown User',
          verifiedAt: log.verifiedAt,
        };
      })
    );

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

  async getVerifications(query?: {
    search?: string;
    category?: string;
    status?: string;
    verifiedBy?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, category, status, verifiedBy, startDate, endDate, page = 1, limit = 10 } = query || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    const assetWhere: any = { isDeleted: false };
    
    // Date range filter
    if (startDate || endDate) {
      where.verifiedAt = {};
      if (startDate) where.verifiedAt.gte = new Date(startDate);
      if (endDate) where.verifiedAt.lte = new Date(endDate);
    }

    // Verified by filter - convert name to user ID
    if (verifiedBy) {
      const user = await this.prisma.user.findFirst({
        where: {
          fullName: { equals: verifiedBy, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (user) {
        where.verifiedBy = user.id;
      } else {
        // No user found with this name, return empty result
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
    }

    // Category and status filters - handle at asset level
    if (category) {
      assetWhere.category = category.toUpperCase() as any;
    }
    if (status) {
      assetWhere.status = status.toUpperCase() as any;
    }

    // If we have asset-level filters or search, get matching asset IDs first
    if (category || status || search) {
      if (search) {
        assetWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const assets = await this.prisma.asset.findMany({
        where: assetWhere,
        select: { id: true },
      });
      
      const assetIds = assets.map(a => a.id);
      if (assetIds.length === 0) {
        // No assets match the filters, return empty result
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
      
      where.assetId = { in: assetIds };
    }

    // Also filter by user name if search is provided and no asset matches
    let userIds: string[] = [];
    if (search && !category && !status) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      userIds = users.map(u => u.id);

      // Combine asset and user filters with OR
      if (where.assetId || userIds.length > 0) {
        const orConditions = [];
        if (where.assetId) orConditions.push({ assetId: where.assetId });
        if (userIds.length > 0) orConditions.push({ verifiedBy: { in: userIds } });
        
        // Remove assetId from where and use OR instead
        delete where.assetId;
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.verificationLog.findMany({
        where,
        orderBy: { verifiedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.verificationLog.count({ where }),
    ]);

    const data = await Promise.all(
      logs.map(async (log) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: log.assetId },
          select: { 
            name: true,
            category: true,
            status: true,
            serialNumber: true,
            location: true,
          },
        });

        const user = await this.prisma.user.findUnique({
          where: { id: log.verifiedBy },
          select: { fullName: true },
        });

        return {
          id: log.id,
          assetId: log.assetId,
          assetName: asset?.name || 'Unknown',
          assetCategory: asset?.category || 'UNKNOWN',
          assetStatus: asset?.status || 'UNKNOWN',
          assetSerialNumber: asset?.serialNumber || '-',
          assetLocation: asset?.location || '-',
          verifiedBy: user?.fullName || 'Unknown User',
          verifiedById: log.verifiedBy,
          timestamp: log.verifiedAt,
        };
      })
    );

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

  async exportVerifications(query?: {
    search?: string;
    category?: string;
    status?: string;
    verifiedBy?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { search, category, status, verifiedBy, startDate, endDate } = query || {};

    const where: any = {};
    const assetWhere: any = { isDeleted: false };
    
    // Date range filter
    if (startDate || endDate) {
      where.verifiedAt = {};
      if (startDate) where.verifiedAt.gte = new Date(startDate);
      if (endDate) where.verifiedAt.lte = new Date(endDate);
    }

    // Verified by filter - convert name to user ID
    if (verifiedBy) {
      const user = await this.prisma.user.findFirst({
        where: {
          fullName: { equals: verifiedBy, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (user) {
        where.verifiedBy = user.id;
      } else {
        // No user found with this name, return empty result
        return {
          data: [],
          total: 0,
          exportedAt: new Date().toISOString(),
        };
      }
    }

    // Category and status filters - handle at asset level
    if (category) {
      assetWhere.category = category.toUpperCase() as any;
    }
    if (status) {
      assetWhere.status = status.toUpperCase() as any;
    }

    // If we have asset-level filters or search, get matching asset IDs first
    if (category || status || search) {
      if (search) {
        assetWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const assets = await this.prisma.asset.findMany({
        where: assetWhere,
        select: { id: true },
      });
      
      const assetIds = assets.map(a => a.id);
      if (assetIds.length === 0) {
        // No assets match the filters
        return {
          data: [],
          total: 0,
          exportedAt: new Date().toISOString(),
        };
      }
      
      where.assetId = { in: assetIds };
    }

    // Also filter by user name if search is provided
    let userIds: string[] = [];
    if (search && !category && !status) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      userIds = users.map(u => u.id);

      // Combine asset and user filters with OR
      if (where.assetId || userIds.length > 0) {
        const orConditions = [];
        if (where.assetId) orConditions.push({ assetId: where.assetId });
        if (userIds.length > 0) orConditions.push({ verifiedBy: { in: userIds } });
        
        // Remove assetId from where and use OR instead
        delete where.assetId;
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }
      }
    }

    const logs = await this.prisma.verificationLog.findMany({
      where,
      orderBy: { verifiedAt: 'desc' },
    });

    const data = await Promise.all(
      logs.map(async (log) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: log.assetId },
          select: { 
            name: true,
            category: true,
            status: true,
            serialNumber: true,
            location: true,
          },
        });

        const user = await this.prisma.user.findUnique({
          where: { id: log.verifiedBy },
          select: { fullName: true, username: true },
        });

        return {
          id: log.id,
          assetId: log.assetId,
          assetName: asset?.name || 'Unknown',
          assetCategory: asset?.category || 'UNKNOWN',
          assetStatus: asset?.status || 'UNKNOWN',
          assetSerialNumber: asset?.serialNumber || '-',
          assetLocation: asset?.location || '-',
          verifiedBy: user?.fullName || 'Unknown User',
          verifiedByUsername: user?.username || '-',
          verifiedAt: log.verifiedAt,
        };
      })
    );

    return {
      data,
      total: data.length,
      exportedAt: new Date().toISOString(),
    };
  }

  async getComplaints(query?: {
    search?: string;
    status?: string;
    category?: string;
    reportedBy?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, status, category, reportedBy, startDate, endDate, page = 1, limit = 10 } = query || {};
    const skip = (page - 1) * limit;

    const where: any = {};
    
    // Status filter
    if (status) where.status = status.toUpperCase();
    
    // Reported by filter
    if (reportedBy) {
      where.reportedBy = reportedBy;
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Category filter - get assets by category first
    if (category) {
      const categoryAssets = await this.prisma.asset.findMany({
        where: {
          category: category.toUpperCase() as any,
          isDeleted: false,
        },
        select: { id: true },
      });

      const categoryAssetIds = categoryAssets.map(a => a.id);
      if (categoryAssetIds.length === 0) {
        // No assets found with this category
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      where.assetId = { in: categoryAssetIds };
    }

    // Search filter - search in asset names, asset IDs, and description
    if (search) {
      const searchConditions = [];

      // Search in description
      searchConditions.push({ description: { contains: search, mode: 'insensitive' } });

      // Search in asset name and ID
      const assets = await this.prisma.asset.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
          ],
          isDeleted: false,
        },
        select: { id: true },
      });

      if (assets.length > 0) {
        searchConditions.push({ assetId: { in: assets.map(a => a.id) } });
      }

      // Search in user name
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (users.length > 0) {
        searchConditions.push({ reportedBy: { in: users.map(u => u.id) } });
      }

      if (searchConditions.length > 0) {
        where.OR = searchConditions;
      } else {
        // No matches found in any search field
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
    }

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    const data = await Promise.all(
      complaints.map(async (complaint) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: complaint.assetId },
          select: { 
            name: true,
            category: true,
            status: true,
            serialNumber: true,
            location: true,
          },
        });

        const user = await this.prisma.user.findUnique({
          where: { id: complaint.reportedBy },
          select: { fullName: true },
        });

        return {
          id: complaint.id,
          assetId: complaint.assetId,
          assetName: asset?.name || 'Unknown',
          assetCategory: asset?.category || 'UNKNOWN',
          assetStatus: asset?.status || 'UNKNOWN',
          assetSerialNumber: asset?.serialNumber || '-',
          assetLocation: asset?.location || '-',
          description: complaint.description,
          status: complaint.status,
          reportedBy: user?.fullName || 'Unknown User',
          reportedById: complaint.reportedBy,
          imageUrl: complaint.imageUrl,
          timestamp: complaint.createdAt,
        };
      })
    );

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

  async exportComplaints(query?: {
    search?: string;
    status?: string;
    reportedBy?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { search, status, reportedBy, startDate, endDate } = query || {};

    const where: any = {};
    
    // Status filter
    if (status) where.status = status.toUpperCase();
    
    // Reported by filter
    if (reportedBy) {
      where.reportedBy = reportedBy;
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Search filter - search in asset names, asset IDs, and description
    if (search) {
      const searchConditions = [];

      // Search in description
      searchConditions.push({ description: { contains: search, mode: 'insensitive' } });

      // Search in asset name and ID
      const assets = await this.prisma.asset.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
          ],
          isDeleted: false,
        },
        select: { id: true },
      });

      if (assets.length > 0) {
        searchConditions.push({ assetId: { in: assets.map(a => a.id) } });
      }

      // Search in user name
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (users.length > 0) {
        searchConditions.push({ reportedBy: { in: users.map(u => u.id) } });
      }

      if (searchConditions.length > 0) {
        where.OR = searchConditions;
      } else {
        // No matches found in any search field
        return {
          data: [],
          total: 0,
          exportedAt: new Date().toISOString(),
        };
      }
    }

    const complaints = await this.prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const data = await Promise.all(
      complaints.map(async (complaint) => {
        const asset = await this.prisma.asset.findUnique({
          where: { id: complaint.assetId },
          select: { 
            name: true,
            category: true,
            status: true,
            serialNumber: true,
            location: true,
          },
        });

        const user = await this.prisma.user.findUnique({
          where: { id: complaint.reportedBy },
          select: { fullName: true, username: true },
        });

        return {
          id: complaint.id,
          assetId: complaint.assetId,
          assetName: asset?.name || 'Unknown',
          assetCategory: asset?.category || 'UNKNOWN',
          assetStatus: asset?.status || 'UNKNOWN',
          assetSerialNumber: asset?.serialNumber || '-',
          assetLocation: asset?.location || '-',
          description: complaint.description,
          status: complaint.status,
          reportedBy: user?.fullName || 'Unknown User',
          reportedByUsername: user?.username || '-',
          imageUrl: complaint.imageUrl || '-',
          createdAt: complaint.createdAt,
        };
      })
    );

    return {
      data,
      total: data.length,
      exportedAt: new Date().toISOString(),
    };
  }

  async resolveComplaint(id: string, resolveData: any) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return this.prisma.complaint.update({
      where: { id },
      data: { 
        status: 'RESOLVED',
        resolution: resolveData.resolution,
      },
    });
  }

  async getComplaintById(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Fetch asset details
    const asset = await this.prisma.asset.findUnique({
      where: { id: complaint.assetId },
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        serialNumber: true,
        imageUrl: true,
      },
    });

    // Fetch reported by user details
    const reportedByUser = await this.prisma.user.findUnique({
      where: { id: complaint.reportedBy },
      select: {
        fullName: true,
      },
    });

    return {
      id: complaint.id,
      status: complaint.status,
      description: complaint.description,
      resolution: complaint.resolution || null,
      assetId: complaint.assetId,
      assetName: asset?.name || 'Unknown',
      assetCategory: asset?.category || 'UNKNOWN',
      assetSerialNumber: asset?.serialNumber || null,
      assetStatus: asset?.status || 'UNKNOWN',
      assetImageUrl: asset?.imageUrl || null,
      reportedBy: reportedByUser?.fullName || 'Unknown User',
      date: complaint.createdAt,
      createdAt: complaint.createdAt,
      imageUrl: complaint.imageUrl || null,
    };
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
        avatarUrl: true,
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
        id: uuidv4(),
        fullName: createUserDto.fullName,
        email: createUserDto.email,
        username: createUserDto.username,
        password: hashedPassword,
        role: createUserDto.role,
        designation: createUserDto.designation,
        phone: createUserDto.phone,
        isActive: createUserDto.isActive,
        avatarUrl: createUserDto.avatarUrl || null,
        updatedAt: new Date(),
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
        avatarUrl: true,
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
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        designation: true,
        phone: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for duplicate username if username is being updated
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: updateUserDto.username },
      });

      if (existingUsername) {
        throw new ConflictException('Username already exists');
      }
    }

    // Check for duplicate email if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Prepare update data
    const updateData: any = {
      fullName: updateUserDto.fullName,
      email: updateUserDto.email,
      username: updateUserDto.username,
      role: updateUserDto.role,
      designation: updateUserDto.designation,
      phone: updateUserDto.phone,
      isActive: updateUserDto.isActive,
      avatarUrl: updateUserDto.avatarUrl,
    };

    // Hash password if provided
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(
      key => updateData[key] === undefined && delete updateData[key]
    );

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        designation: true,
        phone: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { role: 'ADMIN' },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin user');
      }
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async setDefaultAvatarsForUsers() {
    // Default avatar placeholder image (SVG or any default image URL)
    const defaultAvatarUrl = 'https://ui-avatars.com/api/?name=User&background=random';

    // Update all users without avatars
    const result = await this.prisma.user.updateMany({
      where: {
        avatarUrl: null,
      },
      data: {
        avatarUrl: defaultAvatarUrl,
      },
    });

    return {
      message: 'Default avatars set successfully',
      updatedCount: result.count,
      avatarUrl: defaultAvatarUrl,
    };
  }

  async generateQrCodes(generateQrDto: GenerateQrDto) {
    try {
      const { count } = generateQrDto;

      // Additional validation in service layer
      if (!count || typeof count !== 'number' || count < 1 || count > 100) {
        throw new BadRequestException('Count must be a number between 1 and 100');
      }

      // Find the last QR code with the new format (5-digit zero-padded)
      const allQrCodes = await this.prisma.qrCode.findMany({
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });

      // Filter for new format QR codes (ID-000101, ID-000102, etc.) - 6 digits with leading zeros
      const newFormatCodes = allQrCodes.filter(qr => {
        const match = qr.code.match(/^ID-(\d{6})$/);
        return match !== null;
      });

      // Extract the number from the last QR code in new format
      let nextNumber = 101; // Start from 101 if no QR codes exist (will be formatted as 000101)
      if (newFormatCodes.length > 0) {
        const match = newFormatCodes[0].code.match(/ID-(\d+)/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      // Generate sequential QR codes with 6-digit zero-padded format
      const qrCodes = [];
      for (let i = 0; i < count; i++) {
        const formattedNumber = String(nextNumber + i).padStart(6, '0');
        const code = `ID-${formattedNumber}`;
        qrCodes.push({
          id: uuidv4(),
          code,
          isAssigned: false,
        });
      }

      // Bulk insert
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
        orderBy: { code: 'asc' },
      });

      return {
        count: result.length,
        qrCodes: result,
        startNumber: nextNumber,
        endNumber: nextNumber + count - 1,
      };
    } catch (error) {
      console.error('Error generating QR codes:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to generate QR codes: ${error.message || 'Unknown error'}`);
    }
  }

  async getAssets(query?: {
    search?: string;
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const { search, category, status, page = 1, limit = 10 } = query || {};
      const skip = (page - 1) * limit;

      const where: any = { isDeleted: false };

      // Search filter
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Category filter
      if (category) {
        where.category = category.toUpperCase();
      }

      // Status filter
      if (status) {
        where.status = status.toUpperCase();
      }

      // Fetch assets with pagination
      const [assets, total] = await Promise.all([
        this.prisma.asset.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
          },
        }),
        this.prisma.asset.count({ where }),
      ]);

      return {
        data: assets,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error in getAssets: ${error.message}`, error.stack);
      throw error;
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
      imageUrl: asset.imageUrl,
      qrCode: qrCode?.code || null,
      createdAt: asset.createdAt,
      lastVerifiedAt: asset.lastVerifiedAt,
      addedBy: createdByUser?.fullName || 'Unknown',
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

    // Generate new unique QR code using sequential numbering (new format only)
    // Find QR codes with the new format (5-digit zero-padded)
    const allQrCodes = await this.prisma.qrCode.findMany({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    // Filter for new format QR codes (ID-000101, ID-000102, etc.) - 6 digits with leading zeros
    const newFormatCodes = allQrCodes.filter(qr => {
      const match = qr.code.match(/^ID-(\d{6})$/);
      return match !== null;
    });

    // Extract the number from the last QR code in new format
    let nextNumber = 101; // Start from 101 if no QR codes exist (will be formatted as 000101)
    if (newFormatCodes.length > 0) {
      const match = newFormatCodes[0].code.match(/ID-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const formattedNumber = String(nextNumber).padStart(6, '0');
    const newCode = `ID-${formattedNumber}`;

    // Create new QR code and assign to asset
    const newQr = await this.prisma.qrCode.create({
      data: {
        id: uuidv4(),
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

  async addToMaintenance(assetId: string) {
    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Update asset status to MAINTENANCE
    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: 'MAINTENANCE',
      },
    });

    return {
      message: 'Asset added to maintenance successfully',
      asset: updatedAsset,
    };
  }
}