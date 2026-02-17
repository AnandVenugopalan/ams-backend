import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async login(username: string, password: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        this.logger.warn(`Login failed - user not found: username=${username}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        this.logger.warn(`Login failed - account inactive: id=${user.id}, username=${username}`);
        throw new ForbiddenException('Account is inactive');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        this.logger.warn(`Login failed - invalid password: id=${user.id}, username=${username}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, username: user.username, role: user.role };
      const accessToken = this.jwtService.sign(payload);

      this.logger.log(`User logged in: id=${user.id}, username=${username}`);

      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        accessToken,
      };
    } catch (err) {
      // Only log truly unexpected errors (not the expected HTTP exceptions we already logged)
      if (!(err instanceof UnauthorizedException) && !(err instanceof ForbiddenException)) {
        this.logger.error(`Unexpected login error for username=${username}`, err.stack || err.message);
      }
      throw err;
    }
  }

  async logout(userId: string) {
    // JWT logout is handled client-side by removing the token
    // This endpoint confirms the logout action and can be extended
    // for token blacklisting or session management if needed
    return {
      message: 'Logged out successfully',
      userId,
      loggedOutAt: new Date().toISOString(),
    };
  }
}