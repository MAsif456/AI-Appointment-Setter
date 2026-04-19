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

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hash(raw: string): string {
    const secret = this.configService.get<string>('JWT_SECRET') ?? '';
    return crypto.createHmac('sha256', secret).update(raw).digest('hex');
  }

  /**
   * Issues a new 15-minute access token and a 7-day refresh token.
   * Optionally accepts existingFamily to continue a rotation chain rather than starting a new one.
   * The caller (controller) is responsible for setting rawRefreshToken as an HttpOnly cookie —
   * this service never touches the HTTP response object.
   */
  async generateTokenPair(
    payload: AccessTokenPayload,
    ipAddress?: string,
    userAgent?: string,
    existingFamily?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: '15m' },
    );
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const family = existingFamily ?? crypto.randomUUID();

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(payload.sub),
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
   * Rotates a refresh token: validates the current token, marks it used, and issues a fresh pair.
   * Reuse of an already-used token signals theft — the entire family is revoked immediately.
   */
  async rotate(
    raw: string,
    payload: AccessTokenPayload,
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
      this.logger.warn(
        `Token reuse detected: userId=${record.userId}, family=${record.family}, ip=${ipAddress}, timestamp=${new Date().toISOString()}`,
      );
      throw new UnauthorizedException('Token reuse detected — please log in again');
    }

    record.used = true;
    await record.save();

    return this.generateTokenPair(payload, ipAddress, userAgent, record.family);
  }

  /**
   * Deletes all refresh tokens for a given user.
   * Called on explicit logout or admin-initiated session revocation.
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
   * Returns the number of documents deleted.
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.refreshTokenModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    return result.deletedCount;
  }
}
