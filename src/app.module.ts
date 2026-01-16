import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AssetModule } from './asset/asset.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [ConfigModule.forRoot(), PrismaModule, AuthModule, AdminModule, AssetModule, StaffModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}