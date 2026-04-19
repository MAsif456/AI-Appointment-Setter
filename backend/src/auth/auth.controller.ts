import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { SensitiveData } from '../security-headers/sensitive-data.decorator';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  CreateUserDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

/**
 * Handles all authentication endpoints.
 * Public routes: login, refresh, verify-email, forgot-password, reset-password.
 * Admin-only: create-user, resend-verification, revoke-all.
 * Authenticated: logout, me, change-password.
 */
@SensitiveData()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** Admin creates a new staff or admin account and sends a verification link. */
  @Post('create-user')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  /** Verifies a user's email address using the token from the link email. */
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  /** Resends a verification link to an unverified email address. Admin-only. */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationLink(email);
  }

  /**
   * Authenticates a verified user.
   * Returns a 15-minute access token (userId + role only, AC1) and sets a 7-day HttpOnly refresh cookie.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const ip = req?.ip ?? req?.socket?.remoteAddress ?? 'unknown';
    this.logger.log(`Login attempt for ${loginDto.email} from IP ${ip}`);

    const { user } = await this.authService.login(loginDto, ip);

    const { accessToken, rawRefreshToken } = await this.refreshTokenService.generateTokenPair(
      { userId: user._id, role: user.role },
      ip,
      req.headers['user-agent'],
    );

    res.cookie(REFRESH_COOKIE, rawRefreshToken, COOKIE_OPTIONS);
    return { accessToken, user };
  }

  /**
   * Issues a new access token by rotating the HttpOnly refresh token cookie.
   * No auth guard and no old access token required — the refresh cookie is the sole proof (AC4).
   * userId is retrieved from the stored token record, not decoded from a header.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('No refresh token');

    const { accessToken, rawRefreshToken } = await this.refreshTokenService.rotate(
      raw,
      req.ip,
      req.headers['user-agent'],
    );

    res.cookie(REFRESH_COOKIE, rawRefreshToken, COOKIE_OPTIONS);
    return { accessToken };
  }

  /** Sends a password reset link to the provided email. */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** Resets the user's password using the token from the reset link email. */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /** Allows a logged-in user to change their own password from Account Settings. */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user._id.toString(), dto);
  }

  /**
   * Revokes only the current device's refresh token and clears the cookie (AC2).
   * Other active sessions (other devices) are unaffected.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await this.refreshTokenService.revokeSingle(raw);
    res.cookie(REFRESH_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    return { message: 'Logged out successfully' };
  }

  /** Admin-only: revokes all sessions for any user by ID. AdminGuard enforces the role check (AC3). */
  @Post('revoke-all/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async revokeAll(@Req() req: any, @Param('userId') userId: string) {
    await this.refreshTokenService.revokeAll(userId);
    this.logger.log(
      `All sessions revoked for userId=${userId} by adminId=${req.user._id} at ${new Date().toISOString()}`,
    );
    return { message: 'All sessions revoked', revokedUserId: userId };
  }

  /** Returns the currently authenticated user's profile. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: any) {
    return req.user;
  }
}
