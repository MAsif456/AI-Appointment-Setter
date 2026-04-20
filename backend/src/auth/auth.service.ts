import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument } from '../database/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import {
  CreateUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { EmailService } from './email.service';
import { AuthThrottleService } from './auth-throttle.service';
import { AnalyticsService } from '../analytics/analytics.service';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Core authentication service.
 * Staff accounts are created by admins only — no public registration.
 * Email verification and password reset use token-based links.
 *
 * The login flow applies IP-based and account-level throttling via
 * AuthThrottleService, and emits security events via AnalyticsService.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private readonly authThrottleService: AuthThrottleService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async createUser(dto: CreateUserDto): Promise<{ message: string }> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new ConflictException('Email is already in use');

    if (dto.role === 'staff' && (!dto.assignedClinics || dto.assignedClinics.length === 0)) {
      throw new BadRequestException('Staff members must have at least one clinic assigned');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = generateToken();

    await this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role,
      assignedClinics: dto.assignedClinics?.map(id => new Types.ObjectId(id)) || [],
      isVerified: false,
      isActive: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tokenVersion: 0,
    });

    await this.emailService.sendVerificationEmail(dto.email, verificationToken);
    this.logger.log(`Admin created user account for ${dto.email}`);
    return { message: 'Account created. A verification link has been sent to the user.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ verificationToken: token });

    if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      throw new BadRequestException('Verification link is invalid or has expired. Please contact an admin.');
    }

    user.isVerified = true;
    user.isActive = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerificationLink(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    const safe = { message: 'If the account exists and is unverified, a new link has been sent.' };
    if (!user || user.isVerified) return safe;
    user.verificationToken = generateToken();
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    await this.emailService.sendVerificationEmail(email, user.verificationToken);
    return safe;
  }

  /**
   * Authenticates a user and returns a JWT token.
   *
   * Applies IP-based and account-level throttling before touching credentials:
   * - Progressive delay for repeated failures (6-10).
   * - IP lockout (11+).
   * - Account lockout across IPs (10+).
   *
   * Uses a generic error message on any failure to prevent account enumeration.
   * tokenVersion is embedded in the JWT so the strategy can detect stale tokens
   * when a user's role has changed since they last logged in.
   *
   * @param dto - The login DTO containing email and password.
   * @param ip - The client IP address for throttle tracking. Defaults to "unknown".
   */
  async login(dto: LoginDto, ip: string = 'unknown') {
    // Check throttle state before doing any credential work
    await this.authThrottleService.checkThrottle(ip, dto.email);

    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });

    if (!user) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      this.logger.warn(`Login failed: unknown email from IP ${ip}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isVerified) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      throw new UnauthorizedException('Please verify your email before logging in.');
    }
    if (!user.isActive) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      this.logger.warn(`Login failed: inactive account ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      this.logger.warn(
        `Login failed: wrong password for ${dto.email} from IP ${ip}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // Success — clear failure counters, update lastLoginAt
    await this.authThrottleService.recordSuccess(ip, dto.email);
    user.lastLoginAt = new Date();
    await user.save();

    this.logger.log(`Login successful for ${dto.email}`);

    this.analyticsService.logSecurityEvent({
      eventType: 'login_success',
      ip,
      email: dto.email,
      userId: (user._id as any).toString(),
      endpoint: '/auth/login',
      tier: 'auth',
    });

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        assignedClinics: user.assignedClinics?.map(id => id.toString()) || [],
      },
      accessToken,
    };
  }

  /** Validates a user by ID — used by the JWT strategy on every request. */
  async validateUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).select('-passwordHash');
    if (!user || !user.isActive) throw new UnauthorizedException('Session expired');
    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    const safe = { message: 'If the email exists, a reset link has been sent.' };
    if (!user) return safe;
    user.passwordResetToken = generateToken();
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await this.emailService.sendPasswordResetEmail(dto.email, user.passwordResetToken);
    return safe;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ passwordResetToken: dto.token });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return { message: 'Password reset successfully. You can now log in.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) throw new BadRequestException('Current password is incorrect');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await user.save();
    return { message: 'Password updated successfully.' };
  }

  /**
   * Decodes a JWT without verifying its signature or checking expiry.
   * This is intentionally unverified — it is only used to extract userId from an
   * expired access token during the refresh flow. The HttpOnly refresh token cookie
   * is the actual security proof; the access token payload is used only to look up
   * the current user in the database so we can embed fresh claims.
   */
  decodeToken(token: string): Record<string, unknown> | null {
    if (!token) return null;
    try {
      return this.jwtService.decode(token) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
