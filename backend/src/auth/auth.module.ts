import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminGuard } from './guards/admin.guard';
import { EmailService } from './email.service';
import { AuthThrottleService } from './auth-throttle.service';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { User, UserSchema } from '../database/schemas/user.schema';
import { Notification, NotificationSchema } from '../database/schemas/notification.schema';
import {
  LoginAttempt,
  LoginAttemptSchema,
} from './schemas/login-attempt.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from '../database/schemas/refresh-token.schema';
import { AnalyticsModule } from '../analytics/analytics.module';

/**
 * Authentication module.
 *
 * Provides JWT-based auth with email verification, password reset,
 * admin-managed user creation, IP + account-level brute force protection,
 * and JWT refresh token rotation with server-side revocation.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') || '7d' },
      }),
    }),
    AnalyticsModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UsersService,
    JwtStrategy,
    AdminGuard,
    EmailService,
    AuthThrottleService,
    RefreshTokenService,
    RefreshTokenCleanupService,
  ],
  exports: [AuthService, UsersService, JwtStrategy, PassportModule, JwtModule, RefreshTokenService],
})
export class AuthModule {}
