import {
  BadRequestException, ConflictException, Injectable,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument } from '../database/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { EmailService } from './email.service';

/** Generates a cryptographically secure URL-safe token */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Core authentication service.
 * Staff accounts are created by admins only — no public registration.
 * Email verification and password reset use token-based links.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /**
   * Creates a new user account (admin-only).
   * Sends a verification link to the new user's email.
   * Staff must have at least one assigned clinic.
   */
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
      isActive: false,
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await this.emailService.sendVerificationEmail(dto.email, verificationToken);
    this.logger.log(`Admin created user account for ${dto.email}`);
    return { message: 'Account created. A verification link has been sent to the user.' };
  }

  /**
   * Verifies a user's email using the token from the link.
   * The token is single-use — cleared after successful verification.
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ verificationToken: token });

    if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      throw new BadRequestException('Verification link is invalid or has expired. Please contact an admin.');
    }

    user.isVerified = true;
    user.isActive = true;
    // Clear token so the link cannot be used again
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return { message: 'Email verified successfully. You can now log in.' };
  }

  /** Resends verification link. Never reveals whether the email exists. */
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
   * The response includes assignedClinics so the frontend can filter
   * clinic access without making a separate API call.
   */
  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid email or password');
    if (!user.isVerified) throw new UnauthorizedException('Please verify your email before logging in.');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save();

    const payload = { sub: user._id.toString(), email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        // assignedClinics as strings so the frontend can compare against clinic._id
        assignedClinics: user.assignedClinics?.map(id => id.toString()) || [],
      },
      accessToken,
    };
  }

  /** Validates a user by ID — used by the JWT strategy on every request. */
  async validateUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).select('-passwordHash');
    // If the user was deleted or deactivated, this throws and the request gets a 401
    if (!user || !user.isActive) throw new UnauthorizedException('Session expired');
    return user;
  }

  /** Sends a password reset link. Always returns generic message to prevent enumeration. */
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

  /** Resets password using the token from the link email. Token is single-use. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ passwordResetToken: dto.token });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    // Clear token so the link cannot be used again
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return { message: 'Password reset successfully. You can now log in.' };
  }

  /** Allows a logged-in user to change their own password from Account Settings. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) throw new BadRequestException('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await user.save();
    return { message: 'Password updated successfully.' };
  }
}