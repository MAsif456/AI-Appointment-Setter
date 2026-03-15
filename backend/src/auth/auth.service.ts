import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument } from '../database/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto } from './dto/register.dto';
import { EmailService } from './email.service';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;

    // Check if user exists
    const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = this.generateCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user
    const user = await this.userModel.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'staff',
      isActive: false,
      isVerified: false,
      verificationCode,
      verificationCodeExpires,
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(email, verificationCode);

    return {
      message: 'Account created. Please check your email for verification code.',
      email: user.email,
    };
  }

  async verifyEmail(verifyDto: VerifyEmailDto) {
    const { email, code } = verifyDto;
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user || user.verificationCode !== code) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    user.isVerified = true;
    user.isActive = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerificationCode(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a new code has been sent.' };
    }    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationCode = this.generateCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await this.emailService.sendVerificationEmail(email, verificationCode);

    return { message: 'Verification code resent. Please check your email.' };
  }

  // Login method returns user info and JWT token
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userModel.findOne({ 
      email: email.toLowerCase() 
    });

    // Check if user exists and is active
    if (!user || !user.isActive) {
      console.log('❌ Login failed: User not found or inactive');
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isVerified) {
      console.log('❌ Login failed: Email not verified');
      throw new UnauthorizedException('Please verify your email before logging in. Check your email for the verification code.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const payload = { 
      sub: user._id.toString(), 
      email: user.email, 
      role: user.role 
    };
    const accessToken = this.jwtService.sign(payload);

    // Return response
    return {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    };
  }

  async validateUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(userId)
      .select('-passwordHash');

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session expired');
    }

    return user;
  }

  // Password forgot methods
  async forgotPassword(forgotDto: ForgotPasswordDto) {
    const { email } = forgotDto;
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset code has been sent.' };
    }

    const resetCode = this.generateCode();
    user.passwordResetCode = resetCode;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await this.emailService.sendPasswordResetEmail(email, resetCode);

    return { message: 'If the email exists, a reset code has been sent.' };
  }

  // Reset password method
  async resetPassword(resetDto: ResetPasswordDto) {
    const { email, code, newPassword } = resetDto;
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user || user.passwordResetCode !== code) {
      throw new BadRequestException('Invalid or expired reset code');
    }
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return { message: 'Password reset successfully. You can now log in.' };
  }
}