import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../database/schemas/refresh-token.schema';
import { User, UserDocument } from '../database/schemas/user.schema';

/** AC1: payload contains only userId, role, and expiry — no PII, no tokenVersion. */
export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  rawRefreshToken: string;
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hash(raw: string): string {
    const secret = this.configService.get<string>('JWT_SECRET') ?? '';
    return crypto.createHmac('sha256', secret).update(raw).digest('hex');
  }

  /**
   * Issues a new 15-minute access token and a 7-day refresh token.
   * Payload contains only userId and role — no email or tokenVersion (AC1).
   * The caller (controller) is responsible for setting rawRefreshToken as an HttpOnly cookie.
   */
  async generateTokenPair(
    payload: AccessTokenPayload,
    ipAddress?: string,
    userAgent?: string,
    existingFamily?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { userId: payload.userId, role: payload.role, type: 'access' },
      { expiresIn: '15m' },
    );
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const family = existingFamily ?? crypto.randomUUID();

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(payload.userId),
      tokenHash: this.hash(rawRefreshToken),
      family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      used: false,
      ipAddress,
      userAgent,
    });

    return { accessToken, rawRefreshToken };
  }

  /**
   * Rotates a refresh token: validates, marks used, fetches current user from DB, issues new pair.
   * userId comes from the stored token record — no old access token needed (AC4).
   * Reuse of an already-used token signals theft — the entire family is revoked immediately (AC3).
   */
  async rotate(
    raw: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const record = await this.refreshTokenModel.findOne({
      tokenHash: this.hash(raw),
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.expiresAt < new Date()) {
      await record.deleteOne();
      throw new UnauthorizedException('Refresh token expired');
    }

    if (record.used) {
      await this.refreshTokenModel.deleteMany({ family: record.family });
      // TODO: Route security alerts to dedicated channel (see future security audit story)
      this.logger.warn(
        `[SECURITY ALERT] Token reuse detected: userId=${record.userId}, family=${record.family}, ip=${ipAddress}, timestamp=${new Date().toISOString()}`,
      );
      throw new UnauthorizedException('Token reuse detected — please log in again');
    }

    record.used = true;
    await record.save();

    const user = await this.userModel.findById(record.userId).select('-passwordHash');
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.generateTokenPair(
      { userId: record.userId.toString(), role: user.role },
      ipAddress,
      userAgent,
      record.family,
    );
  }

  /**
   * Deletes only the specific refresh token for the current device (AC2).
   * Logging out on one device does not invalidate sessions on other devices.
   */
  async revokeSingle(raw: string): Promise<void> {
    if (!raw) {
      this.logger.warn('Logout attempted without refresh token');
      return;
    }
    const result = await this.refreshTokenModel.deleteOne({
      tokenHash: this.hash(raw),
    });
    if (result.deletedCount === 0) {
      this.logger.warn('Logout attempted with non-existent refresh token');
    }
  }

  /**
   * Deletes all refresh tokens for a user — used by admin revocation only (AC5).
   */
  async revokeAll(userId: string): Promise<void> {
    const result = await this.refreshTokenModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
    this.logger.log(
      `Revoked ${result.deletedCount} refresh token(s) for userId=${userId}`,
    );
  }

  /**
   * Belt-and-suspenders cleanup of expired tokens as a fallback to the MongoDB TTL index.
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.refreshTokenModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    return result.deletedCount;
  }
}
