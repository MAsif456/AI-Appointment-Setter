import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  CreateUserDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Handles all authentication endpoints.
 * Public routes: login, verify-email, forgot-password, reset-password.
 * Admin-only: create-user, resend-verification.
 * Authenticated: logout, me, change-password.
 *
 * Note: There is no public /register endpoint.
 * Staff accounts are created by admins via POST /auth/create-user.
 *
 * The login endpoint applies IP-based and account-level throttling
 * via AuthThrottleService (wired inside AuthService.login).
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Admin creates a new staff or admin account.
   * Sends a verification link to the new user's email.
   */
  @Post('create-user')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  /**
   * Verifies a user's email address using the token from the link email.
   * Called by the frontend when the user clicks the verification link.
   */
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  /**
   * Resends a verification link to an unverified email address.
   * Admin-only since staff accounts are admin-managed.
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationLink(email);
  }

  /**
   * Authenticates a verified user and returns a JWT access token.
   * Rate limited by the global guard and the auth throttle service
   * (IP + account-level brute force protection).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ip = req?.ip ?? req?.socket?.remoteAddress ?? 'unknown';
    this.logger.log(`Login attempt for ${loginDto.email} from IP ${ip}`);
    return this.authService.login(loginDto, ip);
  }

  /**
   * Sends a password reset link to the provided email.
   * Always returns the same response to prevent email enumeration.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Resets the user's password using the token from the reset link email.
   * Called by the frontend /reset-password page after the user submits the form.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Allows a logged-in user to change their own password from Account Settings.
   * Requires the current password to be provided for verification.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user._id.toString(), dto);
  }

  /** Invalidates the session — handled client-side, this confirms the action. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  /** Returns the currently authenticated user's profile. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req) {
    return req.user;
  }
}
